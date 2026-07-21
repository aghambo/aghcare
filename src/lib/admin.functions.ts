import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "web_admin" | "hospital_admin" | "manager" | "doctor_room" | "patient";

async function assertRole(userId: string, allowed: AppRole[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  if (!roles.some((r) => allowed.includes(r))) throw new Error("Forbidden");
  return roles;
}

/** Web-admin: full roster (all roles). Hospital-admin: managers only. */
export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await assertRole(context.userId, ["web_admin", "hospital_admin"]);
    const isWebAdmin = roles.includes("web_admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rolesFilter: AppRole[] = isWebAdmin
      ? ["web_admin", "hospital_admin", "manager"]
      : ["manager"];

    const { data: authorized } = await supabaseAdmin
      .from("authorized_emails")
      .select("id, email, role, created_at")
      .in("role", rolesFilter)
      .order("created_at", { ascending: false });

    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .in("role", rolesFilter)
      .order("created_at", { ascending: false });

    const ids = (userRoles ?? []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids)
      : { data: [] as { id: string; email: string | null }[] };
    const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    const active = (userRoles ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      role: r.role as AppRole,
      email: emailById.get(r.user_id) ?? "—",
      created_at: r.created_at,
    }));

    return {
      isWebAdmin,
      authorized: authorized ?? [],
      active,
    };
  });

export const addAuthorized = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      role: z.enum(["hospital_admin", "manager"]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const roles = await assertRole(context.userId, ["web_admin", "hospital_admin"]);
    if (data.role === "hospital_admin" && !roles.includes("web_admin")) {
      throw new Error("Only the Web Admin can authorize hospital admins.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const { error } = await supabaseAdmin
      .from("authorized_emails")
      .insert({ email, role: data.role, created_by: context.userId });
    if (error) {
      if (error.message.includes("duplicate")) throw new Error("That email is already authorized.");
      throw error;
    }
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "account_authorized",
      details: { email, role: data.role },
    });
    return { ok: true };
  });

export const removeAuthorized = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertRole(context.userId, ["web_admin", "hospital_admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("authorized_emails")
      .select("email, role")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    // Hospital admins can only touch manager rows
    const myRoles = await assertRole(context.userId, ["web_admin", "hospital_admin"]);
    if (!myRoles.includes("web_admin") && row.role !== "manager") {
      throw new Error("Forbidden");
    }
    await supabaseAdmin.from("authorized_emails").delete().eq("id", data.id);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "account_deauthorized",
      details: { email: row.email, role: row.role },
    });
    return { ok: true };
  });

export const removeActiveUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userRoleId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const myRoles = await assertRole(context.userId, ["web_admin", "hospital_admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role")
      .eq("id", data.userRoleId)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    if (!myRoles.includes("web_admin") && row.role !== "manager") {
      throw new Error("Forbidden");
    }
    if (row.user_id === context.userId) throw new Error("You cannot remove yourself.");
    await supabaseAdmin.from("user_roles").delete().eq("id", data.userRoleId);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "role_revoked",
      details: { target: row.user_id, role: row.role },
    });
    return { ok: true };
  });
