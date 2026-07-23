import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, unauthenticated read of a small, safe slice of hospital data
 * used by the patient/doctor entry screens. Backed by supabaseAdmin because
 * the underlying tables are RLS-restricted to authenticated staff.
 */

export const getHospitalBackgroundsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ hospitalId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("hospital_media")
      .select("id, url, sort_order")
      .eq("hospital_id", data.hospitalId)
      .eq("media_type", "background")
      .order("sort_order");
    const items = rows ?? [];
    const signed = await Promise.all(
      items.map(async (m) => {
        const { data: s } = await supabaseAdmin.storage
          .from("hospital-media")
          .createSignedUrl(m.url, 3600);
        return { id: m.id, sort_order: m.sort_order, signed: s?.signedUrl ?? null };
      }),
    );
    return signed.filter((s) => !!s.signed) as { id: string; sort_order: number; signed: string }[];
  });

export const getHospitalTimePublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ hospitalId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("hospital_time")
      .select("base_time, set_at")
      .eq("hospital_id", data.hospitalId)
      .order("set_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });
