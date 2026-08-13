import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_patients",
  title: "Search patients",
  description:
    "Search Ambo General Hospital patients the signed-in user may access, by name or FAN/Fayda number. Returns FAN, name, status and insurance flag.",
  inputSchema: {
    query: z.string().trim().describe("Full or partial patient name or FAN number. Empty returns the newest patients."),
    limit: z.number().int().describe("Maximum rows to return (1-50, default 20)").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("patients")
      .select("id, fan_number, full_name, sex, phone, emergency_phone, status, has_insurance, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (query) request = request.or(`full_name.ilike.%${query}%,fan_number.ilike.%${query}%`);
    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
