import { defineTool } from "@lovable.dev/mcp-js";
import { defineTool as _unused } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

void _unused;

export default defineTool({
  name: "list_rooms",
  title: "List doctor rooms",
  description: "List the hospital's doctor rooms with their number, label, doctor name and active status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("rooms").select("*").limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rooms: data ?? [] },
    };
  },
});
