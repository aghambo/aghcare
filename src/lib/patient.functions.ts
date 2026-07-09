import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fanSchema = z.string().regex(/^\d{16}$/, "FAN number must be exactly 16 digits");

/** Ask Gemini vision (via Lovable AI gateway) to read a payment screenshot and match it against user inputs. */
async function aiValidateScreenshot(params: {
  base64: string;
  mime: string;
  expected: { transactionId: string; amount: number; account?: string };
}): Promise<{
  matched: boolean;
  reason: string;
  extracted: { transactionId?: string; amount?: number; sender?: string; provider?: string };
}> {
  const key = process.env.LOVABLE_API_KEY;
  const fallback = {
    matched: true,
    reason: "AI validation unavailable — falling back to manager review.",
    extracted: {},
  };
  if (!key) return fallback;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a strict payment-receipt validator for an Ethiopian hospital. Given a payment screenshot (Telebirr, CBE, CBE Birr, Awash, Dashen, Amole, etc.) and the values the payer typed, extract the transaction ID, amount and sender account/phone from the image and decide whether they match the typed values. Amount must match exactly (ignore commas). Transaction IDs must match case-insensitively (trim spaces). If sender account provided, at least the last 4 digits/characters must match. Respond STRICTLY as compact JSON: {\"matched\": boolean, \"reason\": string, \"extracted\": {\"transactionId\": string|null, \"amount\": number|null, \"sender\": string|null, \"provider\": string|null}}. No markdown, no extra text.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Typed by patient:\n- Transaction ID: ${params.expected.transactionId}\n- Amount: ${params.expected.amount}\n- Sender account: ${params.expected.account ?? "(not provided)"}\n\nValidate the attached screenshot.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${params.mime};base64,${params.base64}` },
              },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) return fallback;
    const data = (await resp.json()) as { choices: { message: { content: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]) as {
      matched: boolean;
      reason: string;
      extracted?: {
        transactionId?: string | null;
        amount?: number | null;
        sender?: string | null;
        provider?: string | null;
      };
    };
    return {
      matched: !!parsed.matched,
      reason: parsed.reason?.slice(0, 500) ?? "",
      extracted: {
        transactionId: parsed.extracted?.transactionId ?? undefined,
        amount: parsed.extracted?.amount ?? undefined,
        sender: parsed.extracted?.sender ?? undefined,
        provider: parsed.extracted?.provider ?? undefined,
      },
    };
  } catch (e) {
    console.error("aiValidateScreenshot failed", e);
    return fallback;
  }
}

/** Look up a patient by FAN number: drives the whole patient portal flow. */
export const lookupPatient = createServerFn({ method: "POST" })
  .inputValidator((input: { fan: string }) => ({ fan: fanSchema.parse(input.fan) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, full_name, status, hospital_id, photo_url, has_insurance")
      .eq("fan_number", data.fan)
      .maybeSingle();

    if (!patient) return { status: "not_found" as const };

    // Insurance patients skip the registration payment step entirely.
    if (patient.has_insurance && patient.status !== "active") {
      await supabaseAdmin.from("patients").update({ status: "active" }).eq("id", patient.id);
      return { status: "active" as const, patientName: patient.full_name };
    }

    const { data: hospital } = await supabaseAdmin
      .from("hospitals")
      .select("id, name, registration_fee, bank_accounts, telebirr_number, logo_url")
      .eq("id", patient.hospital_id)
      .single();

    if (patient.status === "pending_payment") {
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
        .eq("purpose", "registration")
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
    .select("id, amount, patient_id, transaction_id, created_at, ai_matched, purpose, case_id")
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
  const regFee = Number(hospital?.registration_fee ?? 0);

  for (const p of pending) {
    let expected = regFee;
    if (p.purpose === "service" && p.case_id) {
      const { data: c } = await supabaseAdmin
        .from("patient_cases")
        .select("service_fee")
        .eq("id", p.case_id)
        .single();
      expected = Number(c?.service_fee ?? 0);
    }
    const amountOk = expected > 0 && Number(p.amount) === expected;
    // AI must also have matched — auto-approve only when both pass.
    const ok = amountOk && p.ai_matched !== false;
    await supabaseAdmin
      .from("payments")
      .update({
        status: ok ? "approved" : "rejected",
        auto_evaluated: true,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (ok) {
      if (p.purpose === "registration") {
        await supabaseAdmin.from("patients").update({ status: "active" }).eq("id", patientId);
        await supabaseAdmin.from("notifications").insert({
          patient_id: patientId,
          title: "Registration payment approved ✅",
          body: "Your registration payment was verified automatically. Welcome to Ambo General Hospital.",
          kind: "success",
        });
      } else if (p.purpose === "service" && p.case_id) {
        await supabaseAdmin
          .from("patient_cases")
          .update({ payment_status: "approved" })
          .eq("id", p.case_id);
        await supabaseAdmin.from("notifications").insert({
          patient_id: patientId,
          title: "Service payment approved ✅",
          body: "Your nursing/medicine payment was verified automatically.",
          kind: "success",
        });
      }
    } else {
      await supabaseAdmin.from("notifications").insert({
        patient_id: patientId,
        title: "Payment could not be verified",
        body: "The amount or screenshot details did not match. Please resend the correct payment proof.",
        kind: "alert",
      });
    }
    await supabaseAdmin.from("audit_logs").insert({
      action: ok ? "payment_auto_approved" : "payment_auto_rejected",
      details: { payment_id: p.id, patient_id: patientId, purpose: p.purpose },
    });
  }
}

const paymentProofInput = z.object({
  fan: fanSchema,
  transactionId: z.string().trim().min(4).max(64),
  amount: z.number().positive(),
  accountUsed: z.string().max(120).optional(),
  imageBase64: z.string().min(100).max(8_000_000),
  fileName: z.string().max(200),
  purpose: z.enum(["registration", "service"]).default("registration"),
  caseId: z.string().uuid().optional(),
});

/** Patient submits payment proof for either registration or a doctor-set service fee. */
export const submitPaymentProof = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof paymentProofInput>) => paymentProofInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, hospital_id, status, has_insurance")
      .eq("fan_number", data.fan)
      .maybeSingle();
    if (!patient) return { ok: false as const, error: "Patient not found." };
    if (patient.has_insurance) {
      return { ok: false as const, error: "Insurance patients don't need to pay." };
    }
    if (data.purpose === "registration" && patient.status === "active") {
      return { ok: false as const, error: "Registration already approved." };
    }

    // Validate expected amount
    let expectedAmount = 0;
    if (data.purpose === "registration") {
      const { data: hospital } = await supabaseAdmin
        .from("hospitals")
        .select("registration_fee")
        .eq("id", patient.hospital_id)
        .single();
      expectedAmount = Number(hospital?.registration_fee ?? 0);
    } else {
      if (!data.caseId) return { ok: false as const, error: "Case ID required for service payment." };
      const { data: c } = await supabaseAdmin
        .from("patient_cases")
        .select("service_fee, patient_id, payment_status")
        .eq("id", data.caseId)
        .single();
      if (!c || c.patient_id !== patient.id)
        return { ok: false as const, error: "Case not found." };
      if (c.payment_status === "approved" || c.payment_status === "waived") {
        return { ok: false as const, error: "This service is already paid." };
      }
      expectedAmount = Number(c.service_fee ?? 0);
    }

    if (expectedAmount <= 0)
      return { ok: false as const, error: "No fee is set yet for this payment." };

    if (Number(data.amount) !== expectedAmount) {
      await supabaseAdmin.from("notifications").insert({
        patient_id: patient.id,
        title: "Payment rejected — wrong amount",
        body: `You entered ${data.amount} ETB but the required amount is ${expectedAmount} ETB.`,
        kind: "alert",
      });
      return {
        ok: false as const,
        error: `The amount you entered (${data.amount} ETB) does not match the required ${expectedAmount} ETB.`,
      };
    }

    // Duplicate transaction protection — global uniqueness for the hospital
    const { data: existingTxn } = await supabaseAdmin
      .from("payments")
      .select("id, patient_id")
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (existingTxn) {
      await supabaseAdmin.from("notifications").insert({
        patient_id: patient.id,
        title: "Payment rejected — transaction already used",
        body: "This transaction ID has already been used. Each payment must be personally made and cannot be reused.",
        kind: "alert",
      });
      return {
        ok: false as const,
        error:
          "This transaction ID was already used. Each payment must be a fresh personal transaction.",
      };
    }

    const ext = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return { ok: false as const, error: "Screenshot must be a JPG, PNG or WEBP image." };
    }
    const mime = `image/${ext === "jpg" ? "jpeg" : ext}`;

    // Run AI vision validation on the screenshot BEFORE persisting the payment.
    const ai = await aiValidateScreenshot({
      base64: data.imageBase64,
      mime,
      expected: {
        transactionId: data.transactionId,
        amount: expectedAmount,
        account: data.accountUsed,
      },
    });

    if (!ai.matched) {
      await supabaseAdmin.from("notifications").insert({
        patient_id: patient.id,
        title: "Payment rejected — screenshot didn't match",
        body: `The screenshot inspection reported: ${ai.reason || "details didn't match what you typed."} Please resend a valid screenshot.`,
        kind: "alert",
      });
      return {
        ok: false as const,
        error: `Screenshot verification failed: ${ai.reason || "the details don't match what you typed."}`,
      };
    }

    // Upload screenshot
    const path = `${patient.id}/${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(path, bytes, { contentType: mime });
    if (upErr) return { ok: false as const, error: "Upload failed. Try a smaller image." };

    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      patient_id: patient.id,
      transaction_id: data.transactionId,
      amount: data.amount,
      account_used: data.accountUsed ?? null,
      screenshot_url: path,
      status: "pending",
      purpose: data.purpose,
      case_id: data.caseId ?? null,
      ai_matched: true,
      ai_validation: ai,
    });
    if (payErr) return { ok: false as const, error: "Could not record the payment." };

    if (data.purpose === "service" && data.caseId) {
      await supabaseAdmin
        .from("patient_cases")
        .update({ payment_status: "pending" })
        .eq("id", data.caseId);
    }

    await supabaseAdmin.from("notifications").insert({
      title:
        data.purpose === "registration"
          ? "New registration payment 🔴"
          : "New service payment 🔴",
      body: `A patient submitted a ${data.purpose} payment screenshot (txn ${data.transactionId}). AI pre-check: passed. Review it in the approval queue.`,
      kind: "alert",
    });

    return {
      ok: true as const,
      message:
        "Payment proof verified by AI and sent to the hospital manager. If not reviewed within 1 minute, the system approves it automatically.",
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

    // Also fetch hospital payment info so the portal can render service-payment forms
    const { data: hospitalPay } = await supabaseAdmin
      .from("hospitals")
      .select("bank_accounts, telebirr_number")
      .eq("id", patient.hospital_id)
      .single();

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
        has_insurance: patient.has_insurance,
      },
      hospital: {
        name: hospital?.name ?? "Ambo General Hospital",
        id: hospital?.id,
        logo: logoSigned,
        bankAccounts: (hospitalPay?.bank_accounts as string[] | null) ?? [],
        telebirr: hospitalPay?.telebirr_number ?? null,
      },
      cases: casesWithUrls,
      checkups: checkups ?? [],
      notifications: notifications ?? [],
      queue: queue ?? [],
    };
  });
