import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus, FileText, HeartPulse, Loader2, LogOut, Save, Stethoscope } from "lucide-react";
import { getPatientRecord, getRoomQueue, saveCase, validateRoom } from "@/lib/doctor.functions";
import { fileToBase64 } from "@/lib/media";
import { AIAssistant } from "@/components/AIAssistant";
import { HospitalClock } from "@/components/HospitalClock";
import { BackgroundCarousel } from "@/components/PortalShell";

export const Route = createFileRoute("/doctor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Doctor's Room — Ambo General Hospital" },
      { name: "description", content: "Secure doctor room access with patient queue and case management." },
    ],
  }),
  component: DoctorPortal,
});

type RoomSession = {
  roomCode: string;
  room: { id: string; name: string; type: string };
  hospital: { id?: string; name: string; logo: string | null };
};

function DoctorPortal() {
  const validate = useServerFn(validateRoom);
  const fetchQueue = useServerFn(getRoomQueue);
  const fetchRecord = useServerFn(getPatientRecord);
  const persistCase = useServerFn(saveCase);
  const queryClient = useQueryClient();

  const [session, setSession] = useState<RoomSession | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [activePatient, setActivePatient] = useState<{ id: string; queueId?: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("doctor-room-session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch {
        localStorage.removeItem("doctor-room-session");
      }
    }
  }, []);

  const enter = async () => {
    setBusy(true);
    try {
      const result = await validate({ data: { roomCode: code } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const s: RoomSession = { roomCode: code.toUpperCase(), room: result.room, hospital: result.hospital };
      setSession(s);
      localStorage.setItem("doctor-room-session", JSON.stringify(s));
      toast.success(`Welcome to ${result.room.name}`);
    } catch {
      toast.error("Could not validate the Room ID.");
    } finally {
      setBusy(false);
    }
  };

  const { data: queueData } = useQuery({
    queryKey: ["room-queue", session?.roomCode],
    enabled: !!session,
    refetchInterval: 12000,
    queryFn: () => fetchQueue({ data: { roomCode: session!.roomCode } }),
  });

  const { data: record } = useQuery({
    queryKey: ["patient-record", activePatient?.id],
    enabled: !!session && !!activePatient,
    queryFn: () => fetchRecord({ data: { roomCode: session!.roomCode, patientId: activePatient!.id } }),
  });

  // ---- case form ----
  const [caseForm, setCaseForm] = useState({ title: "", notes: "", diagnosis: "", prescriptions: "", checkupDate: "", checkupNote: "", serviceFee: "", serviceDescription: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const submitCase = async () => {
    if (!session || !activePatient || !caseForm.title.trim()) return;
    setSaving(true);
    try {
      const attachments = await Promise.all(
        files.slice(0, 5).map(async (f) => ({ base64: await fileToBase64(f), fileName: f.name })),
      );
      const result = await persistCase({
        data: {
          roomCode: session.roomCode,
          patientId: activePatient.id,
          title: caseForm.title.trim(),
          notes: caseForm.notes || undefined,
          diagnosis: caseForm.diagnosis || undefined,
          prescriptions: caseForm.prescriptions || undefined,
          attachments,
          checkupDate: caseForm.checkupDate || undefined,
          checkupNote: caseForm.checkupNote || undefined,
          queueId: activePatient.queueId,
          serviceFee: caseForm.serviceFee ? parseFloat(caseForm.serviceFee) : undefined,
          serviceDescription: caseForm.serviceDescription || undefined,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Case saved — the patient's history and portal are updated.");
      setCaseForm({ title: "", notes: "", diagnosis: "", prescriptions: "", checkupDate: "", checkupNote: "", serviceFee: "", serviceDescription: "" });

      setFiles([]);
      setActivePatient(null);
      queryClient.invalidateQueries({ queryKey: ["room-queue"] });
    } catch {
      toast.error("Saving failed. Try smaller attachments.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- entry screen ----------
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-hero eth-pattern-strong px-4">
        <div className="card-panel w-full max-w-md animate-fade-up p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta text-terracotta-foreground">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Doctor's Room</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the Room ID generated by the hospital admin. Access only works while the room is approved and active.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && enter()}
            placeholder="AGH-XXXXXX"
            className="mt-4 w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-lg tracking-widest outline-none ring-ring focus:ring-2"
          />
          <button
            onClick={enter}
            disabled={busy || code.trim().length < 4}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl gradient-hero px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enter room
          </button>
        </div>
      </div>
    );
  }

  const queue = queueData?.queue ?? [];
  const followUps = queueData?.followUps ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {session.hospital.logo ? (
            <img src={session.hospital.logo} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero text-primary-foreground">
              <HeartPulse className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">{session.room.name}</h1>
            <p className="text-xs text-muted-foreground">{session.hospital.name} · Doctor's Room</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <HospitalClock hospitalId={session.hospital.id} />
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("doctor-room-session");
                setSession(null);
                setActivePatient(null);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-card hover:bg-muted"
              aria-label="Exit room"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="gold-divider" />
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <BackgroundCarousel hospitalId={session.hospital.id} height="h-40" />

        {!activePatient ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card-panel p-6 lg:col-span-2">
              <h2 className="font-display text-lg font-bold">Patient queue</h2>
              <p className="text-xs text-muted-foreground">Chronological order — first sent appears first.</p>
              <div className="mt-4 space-y-2">
                {queue.map((q: any, i: number) => (
                  <button
                    key={q.id}
                    onClick={() => setActivePatient({ id: q.patients.id, queueId: q.id })}
                    className="flex w-full items-center gap-4 rounded-xl border border-border p-4 text-left transition-all hover:border-primary hover:shadow-card"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full gradient-gold font-display font-bold text-gold-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{q.patients.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        FAN {q.patients.fan_number} · arrived {new Date(q.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary">Open case →</span>
                  </button>
                ))}
                {queue.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No patients in the queue yet. Assignments from the manager appear here automatically.
                  </p>
                )}
              </div>

              {followUps.length > 0 && (
                <>
                  <h3 className="mt-6 flex items-center gap-2 font-display font-bold">
                    <CalendarPlus className="h-4 w-4 text-gold" /> Follow-up reminders due
                  </h3>
                  <div className="mt-2 space-y-2">
                    {followUps.map((f: any) => (
                      <button
                        key={f.id}
                        onClick={() => setActivePatient({ id: f.patients.id })}
                        className="flex w-full items-center gap-3 rounded-xl border border-gold/40 bg-accent p-3 text-left text-sm"
                      >
                        <span className="h-2 w-2 rounded-full bg-gold animate-soft-pulse" />
                        <span className="font-semibold">{f.patients.full_name}</span>
                        <span className="text-xs text-muted-foreground">{f.checkup_date} · {f.note}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <AIAssistant actor="doctor_room" compact context={`Room: ${session.room.name}. Patients waiting: ${queue.length}. Follow-ups due: ${followUps.length}.`} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <button onClick={() => setActivePatient(null)} className="flex items-center gap-1 text-sm font-bold text-primary">
                <ArrowLeft className="h-4 w-4" /> Back to queue
              </button>

              {record && (
                <>
                  <div className="card-panel p-6">
                    <div className="flex items-center gap-4">
                      {record.patient.photo_signed ? (
                        <img src={record.patient.photo_signed} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero font-display text-xl font-bold text-primary-foreground">
                          {record.patient.full_name?.[0]}
                        </div>
                      )}
                      <div>
                        <h2 className="font-display text-xl font-bold">{record.patient.full_name}</h2>
                        <p className="text-xs text-muted-foreground">
                          FAN {record.patient.fan_number} · {record.patient.sex} · born {record.patient.date_of_birth ?? "—"} · {record.patient.phone ?? "no phone"}
                        </p>
                      </div>
                    </div>
                    {record.patient.medical_notes && (
                      <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{record.patient.medical_notes}</p>
                    )}
                  </div>

                  {/* New case entry */}
                  <div className="card-panel p-6">
                    <h3 className="font-display text-lg font-bold">Today's case</h3>
                    <div className="mt-3 space-y-3">
                      <input placeholder="Case title *" value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
                      <textarea placeholder="Clinical notes" rows={3} value={caseForm.notes} onChange={(e) => setCaseForm({ ...caseForm, notes: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
                      <textarea placeholder="Diagnosis" rows={2} value={caseForm.diagnosis} onChange={(e) => setCaseForm({ ...caseForm, diagnosis: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
                      <textarea placeholder="Prescriptions (one per line)" rows={2} value={caseForm.prescriptions} onChange={(e) => setCaseForm({ ...caseForm, prescriptions: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary">
                        📎 {files.length ? `${files.length} file(s) attached` : "Attach images, PDFs or audio (max 5)"}
                        <input type="file" multiple accept="image/*,.pdf,audio/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                      </label>
                      <div className="grid grid-cols-2 gap-3 rounded-xl border border-gold/40 bg-accent p-3">
                        <label className="text-xs font-bold text-muted-foreground">Follow-up checkup date
                          <input type="date" value={caseForm.checkupDate} onChange={(e) => setCaseForm({ ...caseForm, checkupDate: e.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-bold text-muted-foreground">Reminder note
                          <input value={caseForm.checkupNote} onChange={(e) => setCaseForm({ ...caseForm, checkupNote: e.target.value })} placeholder="e.g. bring lab results" className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal" />
                        </label>
                      </div>
                      <button
                        onClick={submitCase}
                        disabled={saving || !caseForm.title.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl gradient-hero px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save to patient history
                      </button>
                    </div>
                  </div>

                  {/* History */}
                  <div className="card-panel p-6">
                    <h3 className="font-display text-lg font-bold">Case history</h3>
                    <div className="mt-3 space-y-4">
                      {record.cases.map((c: any) => (
                        <div key={c.id} className="rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{c.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString()} · {c.rooms?.name ?? ""}
                            </span>
                          </div>
                          {c.diagnosis && <p className="mt-1 text-sm"><span className="font-bold">Diagnosis:</span> {c.diagnosis}</p>}
                          {c.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
                          {c.prescriptions && (
                            <p className="mt-1 whitespace-pre-line rounded-lg bg-muted p-2 text-sm">{c.prescriptions}</p>
                          )}
                          {c.case_attachments?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.case_attachments.map((a: any) =>
                                a.file_type === "image" && a.signed ? (
                                  <a key={a.id} href={a.signed} target="_blank" rel="noreferrer">
                                    <img src={a.signed} alt={a.file_name} loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                                  </a>
                                ) : (
                                  <a key={a.id} href={a.signed ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-semibold">
                                    <FileText className="h-3.5 w-3.5" /> {a.file_name}
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {record.cases.length === 0 && <p className="text-sm text-muted-foreground">No previous cases.</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
            <AIAssistant
              actor="doctor_room"
              context={
                record
                  ? `Patient: ${record.patient.full_name}, ${record.patient.sex}, born ${record.patient.date_of_birth}. Case history: ${record.cases
                      .map((c: any) => `${c.created_at?.slice(0, 10)}: ${c.title} — ${c.diagnosis ?? "no diagnosis"}; notes: ${c.notes ?? ""}; prescriptions: ${c.prescriptions ?? ""}`)
                      .join(" | ")}`
                  : undefined
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}
