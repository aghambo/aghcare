import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs after sign-in. Creates the profile, and assigns a role:
 * - matching authorized_emails entry (set by admins) wins
 * - the very first user of the platform becomes the Web Admin / Owner
 * - anyone else gets no role (blocked)
 */
export const bootstrapUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims.email as string | undefined)?.toLowerCase() ?? "";

    await supabaseAdmin.from("profiles").upsert({ id: userId, email });

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (existing && existing.length > 0) {
      return { role: existing[0].role as string };
    }

    let role: "web_admin" | "hospital_admin" | "manager" | "doctor_room" | "patient" | null = null;

    const { data: authorized } = await supabaseAdmin
      .from("authorized_emails")
      .select("role")
      .eq("email", email)
      .maybeSingle();

    if (authorized) {
      role = authorized.role;
    } else {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "web_admin");
      if (!count) role = "web_admin";
    }

    if (!role) return { role: null };

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "role_assigned",
      details: { role, email },
    });

    return { role: role as string };
  });
