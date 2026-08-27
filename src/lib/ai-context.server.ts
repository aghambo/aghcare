/**
 * Role-scoped snapshot of everything inside the IB Tech E-Health platform that a
 * given actor is allowed to know about. Fed to the AI as ground truth so answers
 * are always about THIS hospital, THIS platform and THIS actor's own records.
 * Server-only: uses the admin client and then filters by role itself.
 */

type Actor = "web_admin" | "hospital_admin" | "manager" | "doctor_room" | "patient";

function line(label: string, value: unknown): string {
  return `${label}: ${value === null || value === undefined || value === "" ? "—" : String(value)}`;
}

function table(rows: Record<string, unknown>[], keys: string[]): string {
  if (!rows.length) return "(none)";
  return rows
    .map((r) => keys.map((k) => `${k}=${r[k] ?? "—"}`).join(", "))
    .join("\n");
}

export async function buildPlatformSnapshot(
  actor: Actor,
  opts: { patientId?: string; roomCode?: string; extra?: string } = {},
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const parts: string[] = [];

  try {
    const { data: hospital } = await supabaseAdmin
      .from("hospitals")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (hospital) {
      const h = hospital as Record<string, unknown>;
      const staffOnly = actor !== "patient";
      parts.push(
        [
          "### Hospital",
          line("Name", h.name),
          line("City / address", h.address ?? h.city),
          line("Rooms purchased", h.room_count),
          ...(staffOnly
            ? [
                line("Registration fee (ETB)", h.registration_fee),
                line("Telebirr number", h.telebirr_number),
                line("Bank accounts", JSON.stringify(h.bank_accounts ?? null)),
                line("Subscription years", h.subscription_years),
                line("Subscription ends", h.subscription_end),
              ]
            : [line("Registration fee (ETB)", h.registration_fee)]),
        ].join("\n"),
      );
    }

    // ---- Rooms: all staff roles ----
    if (actor !== "patient") {
      const { data: rooms } = await supabaseAdmin
        .from("rooms")
        .select("name, type, room_code, active, approved")
        .order("name")
        .limit(120);
      parts.push(
        "### Doctor rooms\n" +
          table((rooms ?? []) as Record<string, unknown>[], ["name", "type", "room_code", "active", "approved"]),
      );
    }

    // ---- Staff accounts: web admin & hospital admin ----
    if (actor === "web_admin" || actor === "hospital_admin") {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .limit(200);
      const counts: Record<string, number> = {};
      for (const r of roles ?? []) counts[(r as { role: string }).role] = (counts[(r as { role: string }).role] ?? 0) + 1;
      parts.push(
        "### Accounts by role\n" +
          Object.entries(counts)
            .map(([role, n]) => `${role}: ${n}`)
            .join("\n"),
      );
    }

    // ---- Queue / registration / payments: manager + admins ----
    if (actor !== "patient" && actor !== "doctor_room") {
      const [{ data: patients }, { data: payments }] = await Promise.all([
        supabaseAdmin
          .from("patients")
          .select("fan_number, full_name, sex, has_insurance, status, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabaseAdmin
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      parts.push(
        "### Recent patients (newest first)\n" +
          table((patients ?? []) as Record<string, unknown>[], [
            "fan_number",
            "full_name",
            "sex",
            "has_insurance",
            "status",
            "created_at",
          ]),
      );
      parts.push(
        "### Recent payment submissions\n" +
          table((payments ?? []) as Record<string, unknown>[], [
            "kind",
            "amount",
            "transaction_id",
            "sender_account",
            "status",
            "created_at",
          ]),
      );
    }

    // ---- Doctor room: queue + the focused patient's FULL history ----
    if (actor === "doctor_room") {
      if (opts.roomCode) {
        const { data: room } = await supabaseAdmin
          .from("rooms")
          .select("id, name, type")
          .eq("room_code", opts.roomCode.toUpperCase())
          .maybeSingle();
        if (room) {
          parts.push(`### This room\n${line("Name", (room as { name: string }).name)}\n${line("Type", (room as { type: string }).type)}`);
        }
      }
      if (opts.patientId) {
        parts.push(await patientDossier(opts.patientId, true));
      }
    }

    // ---- Patient: their own dossier only ----
    if (actor === "patient" && opts.patientId) {
      parts.push(await patientDossier(opts.patientId, false));
    }
  } catch (e) {
    console.error("snapshot failed", e);
  }

  if (opts.extra) parts.push(`### Screen context\n${opts.extra}`);
  return parts.join("\n\n");
}

/** Complete, chronologically ordered case history for one patient. */
export async function patientDossier(patientId: string, clinical: boolean): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: patient }, { data: cases }, { data: checkups }] = await Promise.all([
    supabaseAdmin.from("patients").select("*").eq("id", patientId).maybeSingle(),
    supabaseAdmin
      .from("patient_cases")
      .select(
        "title, diagnosis, notes, prescriptions, service_description, service_fee, payment_status, created_at",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true })
      .limit(80),
    supabaseAdmin
      .from("checkups")
      .select("checkup_date, note, done")
      .eq("patient_id", patientId)
      .order("checkup_date", { ascending: true })
      .limit(40),
  ]);
  if (!patient) return "### Patient dossier\n(not found)";
  const p = patient as Record<string, unknown>;

  const header = [
    "### Patient dossier — ground truth for this conversation",
    line("Full name", p.full_name),
    line("FAN / Fayda", p.fan_number),
    line("Sex", p.sex),
    line("Date of birth", p.date_of_birth),
    line("Phone", p.phone),
    line("Emergency phone", p.emergency_phone),
    line("Insurance", p.has_insurance ? "YES — fees waived" : "NO — must pay fees"),
    line("Registration status", p.status),
    line("Standing medical notes", p.medical_notes),
    line("Registered on", p.created_at),
    line("Total recorded cases", (cases ?? []).length),
  ].join("\n");

  const history = (cases ?? []).length
    ? (cases as Record<string, unknown>[])
        .map((c, i) =>
          [
            `#### Visit ${i + 1} — ${String(c.created_at ?? "").slice(0, 10)}`,
            line("Case title", c.title),
            line("Diagnosis", c.diagnosis),
            ...(clinical ? [line("Clinical notes", c.notes)] : []),
            line("Prescriptions", c.prescriptions),
            line("Service billed", `${c.service_description ?? "—"} / ${c.service_fee ?? 0} ETB / ${c.payment_status ?? "—"}`),
          ].join("\n"),
        )
        .join("\n\n")
    : "(no previous cases recorded)";

  const followUps = (checkups ?? []).length
    ? (checkups as Record<string, unknown>[])
        .map((c) => `- ${c.checkup_date}: ${c.note ?? "follow-up"} (${c.done ? "done" : "pending"})`)
        .join("\n")
    : "(no follow-ups scheduled)";

  return `${header}\n\n### Full visit-by-visit history (oldest → newest)\n${history}\n\n### Follow-up schedule\n${followUps}`;
}
