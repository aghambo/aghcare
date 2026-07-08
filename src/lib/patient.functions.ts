import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fanSchema = z.string().regex(/^\d{16}$/, "FAN number must be exactly 16 digits");

/** Look up a patient by FAN number: drives the whole patient portal flow. */
export const lookupPatient = createServerFn({ method: "POST" })
  .inputValidator((input: { fan: string }) => ({ fan: fanSchema.parse(input.fan) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, full_name, status, hospital_id, photo_url")
      .eq("fan_number", data.fan)
      .maybeSingle();

    if (!patient) return { status: "not_found" as const };

    const { data: hospital } = await supabaseAdmin
      .from("hospitals")
      .select("id, name, registration_fee, bank_accounts, telebirr_number, logo_url")
      .eq("id", patient.hospital_id)
      .single();

    if (patient.status === "pending_payment") {
      // Auto-evaluate any pending payment older than 60 seconds
      await autoEvaluateForPatient(patient.id);
      const { data: refreshed } = await supabaseAdmin
        .from("patients")
        .select("status")
        .eq("id", patient.id)
        .single();
      const { data: lastPayment } = await supabaseAdmin
        .from("payments")
        .select("status, created_at")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (refreshed?.status === "active") {
        return { status: "active" as const, patientName: patient.full_name };
      }
      return {
        status: "pending_payment" as const,
        patientName: patient.full_name,
        fee: Number(hospital?.registration_fee ?? 0),
        bankAccounts: (hospital?.bank_accounts as string[] | null) ?? [],
        telebirr: hospital?.telebirr_number ?? null,
        lastPaymentStatus: lastPayment?.status ?? null,
      };
    }

    return { status: "active" as const, patientName: patient.full_name };
  });

async function autoEvaluateForPatient(patientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: pending } = await supabaseAdmin
    .from("payments")
    .select("id, amount, patient_id, transaction_id, created_at")
    .eq("patient_id", patientId)
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (!pending?.length) return;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("hospital_id, full_name")
    .eq("id", patientId)
    .single();
  const { data: hospital } = await supabaseAdmin
    .from("hospitals")
    .select("registration_fee")
    .eq("id", patient!.hospital_id)
    .single();
  const fee = Number(hospital?.registration_fee ?? 0);

  for (const p of pending) {
    const ok = fee > 0 && Number(p.amount) >= fee;
    await supabaseAdmin
      .from("payments")
      .update({
        status: ok ? "approved" : "rejected",
        auto_evaluated: true,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (ok) {
      await supabaseAdmin.from("patients").update({ status: "active" }).eq("id", patientId);
      await supabaseAdmin.from("notifications").insert({
        patient_id: patientId,
        title: "Payment approved ✅",
        body: "Your registration payment was verified automatically. Welcome to Ambo General Hospital.",
        kind: "success",
      });
    } else {
      await supabaseAdmin.from("notifications").insert({
        patient_id: patientId,
        title: "Payment could not be verified",
        body: "The amount did not match the registration fee. Please resend the correct payment proof.",
        kind: "alert",
      });
    }
    await supabaseAdmin.from("audit_logs").insert({
      action: ok ? "payment_auto_approved" : "payment_auto_rejected",
      details: { payment_id: p.id, patient_id: patientId },
    });
  }
}

/** Patient submits payment proof: screenshot + transaction ID + amount. */
export const submitPaymentProof = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      fan: string;
      transactionId: string;
      amount: number;
      accountUsed?: string;
      imageBase64: string;
      fileName: string;
    }) =>
      z
        .object({
          fan: fanSchema,
          transactionId: z.string().trim().min(4).max(64),
          amount: z.number().positive(),
          accountUsed: z.string().max(120).optional(),
          imageBase64: z.string().min(100).max(8_000_000),
          fileName: z.string().max(200),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, hospital_id, status")
      .eq("fan_number", data.fan)
      .maybeSingle();
    if (!patient) return { ok: false as const, error: "Patient not found." };
    if (patient.status === "active") return { ok: false as const, error: "Already approved." };

    // Duplicate transaction protection
    const { data: existingTxn } = await supabaseAdmin
      .from("payments")
      .select("id, patient_id")
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (existingTxn) {
      await supabaseAdmin.from("notifications").insert({
        patient_id: patient.id,
        title: "Payment rejected — transaction already used",
        body: "This transaction ID has already been used. Payment must be made personally for each registration.",
        kind: "alert",
      });
      return {
        ok: false as const,
        error:
          "This transaction ID was already used. Each registration requires its own personal payment.",
      };
    }

    // Upload the screenshot
    const ext = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return { ok: false as const, error: "Screenshot must be a JPG, PNG or WEBP image." };
    }
    const path = `${patient.id}/${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });
    if (upErr) return { ok: false as const, error: "Upload failed. Try a smaller image." };

    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      patient_id: patient.id,
      transaction_id: data.transactionId,
      amount: data.amount,
      account_used: data.accountUsed ?? null,
      screenshot_url: path,
      status: "pending",
    });
    if (payErr) return { ok: false as const, error: "Could not record the payment." };

    // Red alert for the manager side
    await supabaseAdmin.from("notifications").insert({
      title: "New payment proof received 🔴",
      body: `A patient submitted a payment screenshot (txn ${data.transactionId}). Review it in the approval queue.`,
      kind: "alert",
    });

    return {
      ok: true as const,
      message:
        "Payment proof sent to the hospital manager. If not reviewed within 1 minute, the system verifies it automatically.",
    };
  });

/** Full patient portal data for an approved patient. */
export const getPatientPortal = createServerFn({ method: "POST" })
  .inputValidator((input: { fan: string }) => ({ fan: fanSchema.parse(input.fan) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("fan_number", data.fan)
      .eq("status", "active")
      .maybeSingle();
    if (!patient) return null;

    const [{ data: hospital }, { data: cases }, { data: checkups }, { data: notifications }, { data: queue }] =
      await Promise.all([
        supabaseAdmin
          .from("hospitals")
          .select("id, name, logo_url")
          .eq("id", patient.hospital_id)
          .single(),
        supabaseAdmin
          .from("patient_cases")
          .select("*, case_attachments(*), rooms(name)")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("checkups")
          .select("*, rooms(name)")
          .eq("patient_id", patient.id)
          .eq("completed", false)
          .order("checkup_date"),
        supabaseAdmin
          .from("notifications")
          .select("*")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("room_queue")
          .select("*, rooms(name)")
          .eq("patient_id", patient.id)
          .neq("status", "done")
          .order("created_at", { ascending: false }),
      ]);

    // Signed URLs for attachments
    const casesWithUrls = await Promise.all(
      (cases ?? []).map(async (c) => ({
        ...c,
        case_attachments: await Promise.all(
          (c.case_attachments ?? []).map(async (a: { url: string } & Record<string, unknown>) => {
            const { data: s } = await supabaseAdmin.storage
              .from("patient-files")
              .createSignedUrl(a.url, 3600);
            return { ...a, signed: s?.signedUrl ?? null };
          }),
        ),
      })),
    );

    let logoSigned: string | null = null;
    if (hospital?.logo_url) {
      const { data: s } = await supabaseAdmin.storage
        .from("hospital-media")
        .createSignedUrl(hospital.logo_url, 3600);
      logoSigned = s?.signedUrl ?? null;
    }

    return {
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        fan_number: patient.fan_number,
        sex: patient.sex,
        date_of_birth: patient.date_of_birth,
        phone: patient.phone,
      },
      hospital: { name: hospital?.name ?? "Ambo General Hospital", id: hospital?.id, logo: logoSigned },
      cases: casesWithUrls,
      checkups: checkups ?? [],
      notifications: notifications ?? [],
      queue: queue ?? [],
    };
  });
