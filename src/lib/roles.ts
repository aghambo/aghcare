export type AppRole = "web_admin" | "hospital_admin" | "manager" | "doctor_room" | "patient";

export const ROLE_LABELS: Record<AppRole, string> = {
  web_admin: "Web Admin / Owner",
  hospital_admin: "Hospital Admin / Director",
  manager: "Hospital Manager",
  doctor_room: "Doctor's Room",
  patient: "Patient",
};

export const ROLE_HOME: Record<string, string> = {
  web_admin: "/web-admin",
  hospital_admin: "/hospital-admin",
  manager: "/manager",
};
