import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Search,
  Send,
  UserPlus,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl, useHospital } from "@/lib/media";
import { PortalShell } from "@/components/PortalShell";
import { AIAssistant } from "@/components/AIAssistant";

export const Route = createFileRoute("/_authenticated/manager")({
  head: () => ({ meta: [{ title: "Hospital Manager — Ambo General Hospital" }] }),
  component: ManagerPortal,
});

function ManagerPortal() {
  const queryClient = useQueryClient();
  const { data: hospital } = useHospital();

  // ---------- payment approval queue ----------
  const { data: pendingPayments } = useQuery({
    queryKey: ["pending-payments"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, patients(id, full_name, fan_number)")
        .eq("status", "pending")
        .order("created_at");
      const withUrls = await Promise.all(
        (data ?? []).map(async (p) => ({
          ...p,
          screenshot_signed: p.screenshot_url ? await signedUrl("payment-proofs", p.screenshot_url) : null,
        })),
      );
      return withUrls;
    },
  });

  const reviewPayment = useMutation({
    mutationFn: async ({ id, approve, patientId }: { id: string; approve: boolean; patientId: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payments")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: me.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      if (approve) {
        await supabase.from("patients").update({ status: "active" }).eq("id", patientId);
        await supabase.from("notifications").insert({
          patient_id: patientId,
          title: "Payment approved ✅",
          body: "Your registration payment was approved. Welcome to Ambo General Hospital!",
          kind: "success",
        });
      } else {
        await supabase.from("notifications").insert({
          patient_id: patientId,
          title: "Payment rejected",
          body: "Your payment proof could not be verified. Please resend the correct screenshot.",
          kind: "alert",
        });
      }
    },
    onSuccess: (_, v) => {
      toast.success(v.approve ? "Patient approved ✅" : "Payment rejected");
      queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // ---------- patient registration ----------
  const [form, setForm] = useState({
    fullName: "",
    fan: "",
    dob: "",
    pob: "",
    sex: "female",
    phone: "",
    txn: "",
    caseInfo: "",
    notes: "",
    hasInsurance: false,
  });
  const [photo, setPhoto] = useState<File | null>(null);

  const registerPatient = useMutation({
    mutationFn: async () => {
      if (!hospital) throw new Error("Hospital not loaded");
      if (!/^\d{16}$/.test(form.fan)) throw new Error("FAN number must be exactly 16 digits");
      const { data: me } = await supabase.auth.getUser();
      let photoPath: string | null = null;
      if (photo) {
        photoPath = `photos/${form.fan}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("patient-files").upload(photoPath, photo);
        if (upErr) throw new Error("Photo upload failed");
      }
      const { data: patient, error } = await supabase
        .from("patients")
        .insert({
          hospital_id: hospital.id,
          full_name: form.fullName.trim(),
          fan_number: form.fan,
          date_of_birth: form.dob || null,
          place_of_birth: form.pob || null,
          sex: form.sex,
          phone: form.phone || null,
          medical_notes: form.notes || null,
          photo_url: photoPath,
          registered_by: me.user?.id,
          has_insurance: form.hasInsurance,
          // Insurance patients skip registration payment entirely
          status: form.hasInsurance ? "active" : "pending_payment",
        })
        .select("id")
        .single();
      if (error) {
        if (error.message.includes("duplicate")) throw new Error("A patient with this FAN number already exists.");
        throw error;
      }
      if (form.caseInfo.trim()) {
        await supabase.from("patient_cases").insert({
          patient_id: patient.id,
          title: "Initial case information",
          notes: form.caseInfo.trim(),
          created_by: me.user?.id,
          payment_status: "waived",
        });
      }
      await supabase.from("audit_logs").insert({
        user_id: me.user?.id ?? null,
        action: "patient_registered",
        details: { patient_id: patient.id, fan: form.fan, insurance: form.hasInsurance },
      });
    },
    onSuccess: () => {
      toast.success(
        form.hasInsurance
          ? "Insured patient registered — no payment needed. They can open the portal now."
          : "Patient registered. They must pay the registration fee before accessing the portal.",
      );
      setForm({ fullName: "", fan: "", dob: "", pob: "", sex: "female", phone: "", txn: "", caseInfo: "", notes: "", hasInsurance: false });
      setPhoto(null);
    },
    onError: (e) => toast.error(e.message),
  });


  // ---------- patient lookup & room assignment ----------
  const [searchFan, setSearchFan] = useState("");
  const [foundPatient, setFoundPatient] = useState<Record<string, any> | null>(null);

  const lookup = async () => {
    const { data } = await supabase
      .from("patients")
      .select("*, patient_cases(id, title, diagnosis, created_at)")
      .eq("fan_number", searchFan.trim())
      .maybeSingle();
    if (!data) {
      toast.error("No patient found with that FAN number.");
      setFoundPatient(null);
      return;
    }
    setFoundPatient(data);
  };

  const { data: rooms } = useQuery({
    queryKey: ["all-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("*").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const [assignRoomId, setAssignRoomId] = useState("");
  const assignToRoom = useMutation({
    mutationFn: async () => {
      if (!foundPatient || !assignRoomId) throw new Error("Choose a room first");
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("room_queue").insert({
        room_id: assignRoomId,
        patient_id: foundPatient.id,
        assigned_by: me.user?.id,
      });
      if (error) throw error;
      const room = rooms?.find((r) => r.id === assignRoomId);
      await supabase.from("notifications").insert({
        patient_id: foundPatient.id,
        title: "Room assignment",
        body: `You have been assigned to ${room?.name ?? "a room"}. Please proceed there.`,
        kind: "info",
      });
    },
    onSuccess: () => toast.success("Patient sent to the room queue with full history attached."),
    onError: (e) => toast.error(e.message),
  });

  // ---------- time setup ----------
  const [timeInput, setTimeInput] = useState("");
  const setHospitalTime = useMutation({
    mutationFn: async () => {
      if (!hospital || !timeInput) throw new Error("Pick a date & time");
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("hospital_time").insert({
        hospital_id: hospital.id,
        base_time: new Date(timeInput).toISOString(),
        set_by: me.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hospital time set — it now appears in doctor rooms and the patient portal.");
      queryClient.invalidateQueries({ queryKey: ["hospital-time"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // ---------- checkups due ----------
  const { data: dueCheckups } = useQuery({
    queryKey: ["due-checkups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkups")
        .select("*, patients(full_name, fan_number), rooms(name)")
        .eq("completed", false)
        .lte("checkup_date", new Date().toISOString().slice(0, 10))
        .order("checkup_date");
      return data ?? [];
    },
  });

  // Realtime: new payments pop in
  useEffect(() => {
    const channel = supabase
      .channel("mgr-payments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
        toast.error("🔴 New payment proof received — review it in the approval queue", { duration: 6000 });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const pendingCount = pendingPayments?.length ?? 0;

  return (
    <PortalShell
      title="Hospital Manager"
      subtitle={`${hospital?.name ?? "Ambo General Hospital"} · Patient operations center`}
      requiredRole="manager"
    >
      {/* Payment approval queue */}
      <div className="card-panel p-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BadgeCheck className="h-6 w-6 text-primary" />
            {pendingCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-soft-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Payment approval queue</h2>
            <p className="text-xs text-muted-foreground">
              {pendingCount} patient(s) waiting · unreviewed proofs are auto-evaluated by the system after 1 minute
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(pendingPayments ?? []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">{p.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground">FAN {p.patients?.fan_number}</div>
                </div>
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  UNREVIEWED
                </span>
              </div>
              {p.screenshot_signed && (
                <a href={p.screenshot_signed} target="_blank" rel="noreferrer">
                  <img
                    src={p.screenshot_signed}
                    alt="Payment screenshot"
                    loading="lazy"
                    className="mt-3 h-36 w-full rounded-xl object-cover"
                  />
                </a>
              )}
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <div>Transaction ID: <span className="font-mono font-bold text-foreground">{p.transaction_id}</span></div>
                <div>Amount: <span className="font-bold text-foreground">{Number(p.amount).toLocaleString()} ETB</span> · Fee: {Number(hospital?.registration_fee ?? 0).toLocaleString()} ETB</div>
                {p.account_used && <div>Account used: {p.account_used}</div>}
                <div>Sent {new Date(p.created_at).toLocaleTimeString()}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => reviewPayment.mutate({ id: p.id, approve: true, patientId: p.patient_id })}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-success px-3 py-2 text-xs font-bold text-success-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => reviewPayment.mutate({ id: p.id, approve: false, patientId: p.patient_id })}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          ))}
          {pendingCount === 0 && (
            <p className="col-span-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No payment proofs waiting. New submissions appear here instantly with a red alert.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Register patient */}
        <div className="card-panel p-6">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Register a new patient</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <input placeholder="Full name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="col-span-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <input placeholder="Fayda ID / FAN (16 digits) *" value={form.fan} maxLength={16} onChange={(e) => setForm({ ...form, fan: e.target.value.replace(/\D/g, "") })} className="col-span-2 rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none ring-ring focus:ring-2" />
            <label className="text-xs font-bold text-muted-foreground">Date of birth
              <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-bold text-muted-foreground">Sex
              <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal">
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
            <input placeholder="Place of birth" value={form.pob} onChange={(e) => setForm({ ...form, pob: e.target.value })} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <textarea placeholder="Case information" value={form.caseInfo} onChange={(e) => setForm({ ...form, caseInfo: e.target.value })} rows={2} className="col-span-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <textarea placeholder="Medical notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="col-span-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <label className="col-span-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary">
              {photo ? `📷 ${photo.name}` : "📷 Attach profile picture"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <button
            onClick={() => registerPatient.mutate()}
            disabled={registerPatient.isPending || !form.fullName.trim() || form.fan.length !== 16}
            className="mt-4 w-full rounded-xl gradient-hero px-5 py-3 text-sm font-bold text-primary-foreground shadow-card disabled:opacity-60"
          >
            Register patient
          </button>
        </div>

        <div className="space-y-6">
          {/* Patient lookup */}
          <div className="card-panel p-6">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Patient service flow</h2>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                placeholder="Enter FAN number"
                value={searchFan}
                maxLength={16}
                onChange={(e) => setSearchFan(e.target.value.replace(/\D/g, ""))}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none ring-ring focus:ring-2"
              />
              <button onClick={lookup} className="rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-gold-foreground">
                Find
              </button>
            </div>
            {foundPatient && (
              <div className="mt-4 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{foundPatient.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      FAN {foundPatient.fan_number} · {foundPatient.sex} ·{" "}
                      <span className={foundPatient.status === "active" ? "font-bold text-success" : "font-bold text-terracotta"}>
                        {foundPatient.status === "active" ? "Approved" : "Awaiting payment"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {foundPatient.patient_cases?.length ?? 0} case record(s) on file
                </div>
                <div className="mt-3 flex gap-2">
                  <select
                    value={assignRoomId}
                    onChange={(e) => setAssignRoomId(e.target.value)}
                    className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Assign to room…</option>
                    {(rooms ?? []).map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.room_type})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignToRoom.mutate()}
                    disabled={!assignRoomId || assignToRoom.isPending}
                    className="flex items-center gap-1 rounded-xl gradient-hero px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" /> Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Time setup */}
          <div className="card-panel p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Hospital time setup</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Set year, month, day, hour, minute and second — this clock is displayed in doctor rooms and the patient portal.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="datetime-local"
                step={1}
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              />
              <button
                onClick={() => setHospitalTime.mutate()}
                disabled={setHospitalTime.isPending || !timeInput}
                className="rounded-xl gradient-hero px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                Set time
              </button>
            </div>
          </div>

          {/* Checkups due */}
          <div className="card-panel p-6">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Checkups due</h2>
            </div>
            <div className="mt-3 space-y-2">
              {(dueCheckups ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gold/40 bg-accent p-3 text-sm">
                  <span className="h-2 w-2 rounded-full bg-gold animate-soft-pulse" />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{c.patients?.full_name}</span>{" "}
                    <span className="text-xs text-muted-foreground">→ {c.rooms?.name ?? "room"} · {c.checkup_date}</span>
                  </div>
                </div>
              ))}
              {(dueCheckups ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No follow-up checkups due today.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AIAssistant
        actor="manager"
        context={`Pending payments: ${pendingCount}. Registration fee: ${hospital?.registration_fee} ETB. Active rooms: ${rooms?.length}. Checkups due: ${dueCheckups?.length}.`}
      />
    </PortalShell>
  );
}
