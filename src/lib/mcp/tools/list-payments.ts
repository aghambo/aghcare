import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_payments",
  title: "List payments",
  description:
    "List payment submissions (registration fees and doctor service fees) visible to the signed-in user, newest first, optionally filtered by status.",
  inputSchema: {
    status: z
      .enum(["pending", "approved", "rejected"])
      .describe("Filter by review status. Omit for all statuses.")
      .optional(),
    limit: z.number().int().describe("Maximum rows to return (1-50, default 20)").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("payments")
      .select(
        "id, patient_id, purpose, amount, transaction_id, account_used, status, ai_matched, auto_evaluated, created_at, patients(fan_number, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) request = request.eq("status", status);
    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { payments: data ?? [] },
    };
  },
});
