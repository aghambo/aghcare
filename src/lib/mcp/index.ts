import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import searchPatientsTool from "./tools/search-patients";
import getPatientCasesTool from "./tools/get-patient-cases";
import listRoomsTool from "./tools/list-rooms";
import listPaymentsTool from "./tools/list-payments";
import listNotificationsTool from "./tools/list-notifications";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ambo-health-hub",
  title: "Ambo Health Hub",
  version: "0.1.0",
  instructions:
    "Tools for the IB Tech E-Health platform at Ambo General Hospital. Every tool acts as the signed-in user, so results are limited to what that account may access. Use `whoami` to learn the current role, `search_patients` / `get_patient_cases` for patient records, `list_rooms` for doctor rooms, `list_payments` for registration and service-fee submissions, and `list_notifications` for the user's alerts.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    searchPatientsTool,
    getPatientCasesTool,
    listRoomsTool,
    listPaymentsTool,
    listNotificationsTool,
  ],
});
