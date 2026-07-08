import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const roomCodeSchema = z.string().trim().min(4).max(40);

/** Validate a doctor's Room ID; returns room + hospital branding when valid and active. */
export const validateRoom = createServerFn({ method: "POST" })
  .inputValidator((input: { roomCode: string }) => ({ roomCode: roomCodeSchema.parse(input.roomCode) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, name, room_type, active, hospital_id")
      .eq("room_code", data.roomCode.toUpperCase())
      .maybeSingle();
    if (!room || !room.active) return { ok: false as const, error: "Invalid or deactivated Room ID." };

    const { data: hospital } = await supabaseAdmin
      .from("hospitals")
      .select("id, name, logo_url")
      .eq("id", room.hospital_id)
      .single();

    let logoSigned: string | null = null;
    if (hospital?.logo_url) {
      const { data: s } = await supabaseAdmin.storage
        .from("hospital-media")
        .createSignedUrl(hospital.logo_url, 3600);
      logoSigned = s?.signedUrl ?? null;
    }

    return {
      ok: true as const,
      room: { id: room.id, name: room.name, type: room.room_type },
      hospital: { id: hospital?.id, name: hospital?.name ?? "", logo: logoSigned },
    };
  });

/** Chronological patient queue for a room. */
export const getRoomQueue = createServerFn({ method: "POST" })
  .inputValidator((input: { roomCode: string }) => ({ roomCode: roomCodeSchema.parse(input.roomCode) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, active")
      .eq("room_code", data.roomCode.toUpperCase())
      .maybeSingle();
    if (!room || !room.active) return { queue: [] };

    const { data: queue } = await supabaseAdmin
      .from("room_queue")
      .select("id, status, created_at, patients(id, full_name, fan_number, sex, date_of_birth)")
      .eq("room_id", room.id)
      .neq("status", "done")
      .order("created_at", { ascending: true });

    const { data: followUps } = await supabaseAdmin
      .from("checkups")
      .select("id, checkup_date, note, completed, patients(id, full_name, fan_number)")
      .eq("room_id", room.id)
      .eq("completed", false)
      .lte("checkup_date", new Date().toISOString().slice(0, 10))
      .order("checkup_date");

    return { queue: queue ?? [], followUps: followUps ?? [] };
  });

/** Full record for one patient, opened from the doctor's queue. */
export const getPatientRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { roomCode: string; patientId: string }) =>
    z.object({ roomCode: roomCodeSchema, patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, active")
      .eq("room_code", data.roomCode.toUpperCase())
      .maybeSingle();
    if (!room || !room.active) return null;

    const [{ data: patient }, { data: cases }, { data: checkups }] = await Promise.all([
      supabaseAdmin.from("patients").select("*").eq("id", data.patientId).single(),
      supabaseAdmin
        .from("patient_cases")
        .select("*, case_attachments(*), rooms(name)")
        .eq("patient_id", data.patientId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("checkups")
        .select("*")
        .eq("patient_id", data.patientId)
        .order("checkup_date", { ascending: false }),
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

    let photoSigned: string | null = null;
    if (patient?.photo_url) {
      const { data: s } = await supabaseAdmin.storage
        .from("patient-files")
        .createSignedUrl(patient.photo_url, 3600);
      photoSigned = s?.signedUrl ?? null;
    }

    return { patient: { ...patient, photo_signed: photoSigned }, cases: casesWithUrls, checkups: checkups ?? [] };
  });

/** Doctor saves a case: diagnosis, notes, prescriptions, attachments, optional follow-up checkup. */
export const saveCase = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      roomCode: string;
      patientId: string;
      title: string;
      notes?: string;
      diagnosis?: string;
      prescriptions?: string;
      attachments?: { base64: string; fileName: string }[];
      checkupDate?: string;
      checkupNote?: string;
      queueId?: string;
    }) =>
      z
        .object({
          roomCode: roomCodeSchema,
          patientId: z.string().uuid(),
          title: z.string().trim().min(1).max(200),
          notes: z.string().max(8000).optional(),
          diagnosis: z.string().max(8000).optional(),
          prescriptions: z.string().max(8000).optional(),
          attachments: z
            .array(z.object({ base64: z.string().max(8_000_000), fileName: z.string().max(200) }))
            .max(5)
            .optional(),
          checkupDate: z.string().optional(),
          checkupNote: z.string().max(1000).optional(),
          queueId: z.string().uuid().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, name, active")
      .eq("room_code", data.roomCode.toUpperCase())
      .maybeSingle();
    if (!room || !room.active) return { ok: false as const, error: "Invalid room." };

    const { data: newCase, error } = await supabaseAdmin
      .from("patient_cases")
      .insert({
        patient_id: data.patientId,
        room_id: room.id,
        title: data.title,
        notes: data.notes ?? null,
        diagnosis: data.diagnosis ?? null,
        prescriptions: data.prescriptions ?? null,
      })
      .select("id")
      .single();
    if (error || !newCase) return { ok: false as const, error: "Could not save the case." };

    for (const att of data.attachments ?? []) {
      const ext = att.fileName.split(".").pop()?.toLowerCase() ?? "bin";
      const allowed = ["jpg", "jpeg", "png", "webp", "pdf", "mp3", "wav", "m4a", "ogg"];
      if (!allowed.includes(ext)) continue;
      const path = `${data.patientId}/${newCase.id}/${Date.now()}-${att.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const bytes = Uint8Array.from(atob(att.base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabaseAdmin.storage
        .from("patient-files")
        .upload(path, bytes, { contentType: ext === "pdf" ? "application/pdf" : undefined });
      if (!upErr) {
        await supabaseAdmin.from("case_attachments").insert({
          case_id: newCase.id,
          url: path,
          file_name: att.fileName,
          file_type: ext === "pdf" ? "pdf" : ["mp3", "wav", "m4a", "ogg"].includes(ext) ? "audio" : "image",
        });
      }
    }

    if (data.checkupDate) {
      await supabaseAdmin.from("checkups").insert({
        patient_id: data.patientId,
        room_id: room.id,
        checkup_date: data.checkupDate,
        note: data.checkupNote ?? null,
      });
      await supabaseAdmin.from("notifications").insert({
        patient_id: data.patientId,
        title: "Checkup scheduled 🔔",
        body: `Return visit on ${data.checkupDate} in ${room.name}. ${data.checkupNote ?? ""}`,
        kind: "info",
      });
    }

    if (data.queueId) {
      await supabaseAdmin.from("room_queue").update({ status: "done" }).eq("id", data.queueId);
    }

    await supabaseAdmin.from("notifications").insert({
      patient_id: data.patientId,
      title: "Medical record updated",
      body: `New notes were added to your case in ${room.name}.`,
      kind: "info",
    });
    await supabaseAdmin.from("audit_logs").insert({
      action: "case_saved",
      details: { case_id: newCase.id, room_id: room.id, patient_id: data.patientId },
    });

    return { ok: true as const };
  });
