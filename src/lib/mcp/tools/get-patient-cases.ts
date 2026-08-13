import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_patient_cases",
  title: "Get patient cases",
  description:
    "List the recorded cases (title, diagnosis, notes, prescriptions, service fee, payment status) for one patient, looked up by FAN/Fayda number.",
  inputSchema: {
    fan_number: z.string().trim().describe("The patient's FAN / Fayda number."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ fan_number }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, fan_number, full_name, has_insurance, status")
      .eq("fan_number", fan_number)
      .maybeSingle();
    if (patientError) return { content: [{ type: "text", text: patientError.message }], isError: true };
    if (!patient) {
      return { content: [{ type: "text", text: `No accessible patient with FAN ${fan_number}` }], isError: true };
    }
    const { data: cases, error } = await supabase
      .from("patient_cases")
      .select(
        "id, title, diagnosis, notes, prescriptions, service_description, service_fee, payment_status, created_at, updated_at",
      )
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const payload = { patient, cases: cases ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
