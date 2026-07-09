import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, FileText, FolderOpen, HeartPulse, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { getPatientPortal, lookupPatient, submitPaymentProof } from "@/lib/patient.functions";
import { fileToBase64 } from "@/lib/media";
import { AIAssistant } from "@/components/AIAssistant";
import { HospitalClock } from "@/components/HospitalClock";
import { BackgroundCarousel } from "@/components/PortalShell";

export const Route = createFileRoute("/patient")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Patient Portal — Ambo General Hospital" },
      { name: "description", content: "Open your case, see prescriptions and checkup dates at Ambo General Hospital." },
    ],
  }),
  component: PatientPortal,
});

type PayPurpose = { kind: "service"; caseId: string; fee: number; description: string };

function PatientPortal() {
  const lookup = useServerFn(lookupPatient);
  const submitProof = useServerFn(submitPaymentProof);
  const fetchPortal = useServerFn(getPatientPortal);

  const [fan, setFan] = useState("");
  const [stage, setStage] = useState<"entry" | "payment" | "portal">("entry");
  const [payInfo, setPayInfo] = useState<{ fee: number; bankAccounts: string[]; telebirr: string | null; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCase, setShowCase] = useState(false);
  const [payingService, setPayingService] = useState<PayPurpose | null>(null);

  const enter = async () => {
    if (!/^\d{16}$/.test(fan)) return toast.error("FAN number must be exactly 16 digits.");
    setBusy(true);
    try {
      const r = await lookup({ data: { fan } });
      if (r.status === "not_found") {
        toast.error("No registration found. Please visit the hospital manager to register first.");
      } else if (r.status === "pending_payment") {
        setPayInfo({ fee: r.fee, bankAccounts: r.bankAccounts, telebirr: r.telebirr, name: r.patientName });
        setStage("payment");
        if (r.lastPaymentStatus === "rejected") toast.error("Your last payment proof was rejected. Please resend the correct one.");
      } else {
        setStage("portal");
      }
    } finally {
      setBusy(false);
    }
  };

  // shared payment form state (works for both registration and service)
  const [txn, setTxn] = useState("");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [shot, setShot] = useState<File | null>(null);

  const sendProof = async (purpose: "registration" | "service" = "registration", caseId?: string) => {
    if (!shot || !txn.trim() || !amount) return toast.error("Add the screenshot, transaction ID and amount.");
    setBusy(true);
    try {
      const base64 = await fileToBase64(shot);
      const r = await submitProof({
        data: {
          fan,
          transactionId: txn.trim(),
          amount: parseFloat(amount),
          accountUsed: account || undefined,
          imageBase64: base64,
          fileName: shot.name,
          purpose,
          caseId,
        },
      });
      if (!r.ok) return toast.error(r.error);
      toast.success(r.message);
      setTxn(""); setAmount(""); setShot(null); setAccount("");
      setPayingService(null);
    } finally {
      setBusy(false);
    }
  };

  const { data: portal } = useQuery({
    queryKey: ["patient-portal", fan],
    enabled: stage === "portal",
    refetchInterval: 15000,
    queryFn: () => fetchPortal({ data: { fan } }),
  });

  // poll while waiting for approval
  useQuery({
    queryKey: ["payment-poll", fan],
    enabled: stage === "payment",
    refetchInterval: 10000,
    queryFn: async () => {
      const r = await lookup({ data: { fan } });
      if (r.status === "active") {
        toast.success("Payment approved! Opening your portal…");
        setStage("portal");
      }
      return r;
    },
  });

  if (stage === "entry") {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-hero eth-pattern-strong px-4">
        <div className="glass-strong w-full max-w-md animate-fade-up p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-gold text-gold-foreground">
            <UserRound className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Patient Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your Fayda ID / FAN number (16 digits) to open your health journey.</p>
          <input
            value={fan}
            maxLength={16}
            onChange={(e) => setFan(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && enter()}
            placeholder="0000 0000 0000 0000"
            className="glass-input mt-4 w-full rounded-xl px-4 py-3 text-center font-mono text-lg tracking-widest outline-none ring-ring focus:ring-2"
          />
          <button
            onClick={enter}
            disabled={busy || fan.length !== 16}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl gradient-hero px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue
          </button>
        </div>
      </div>
    );
  }

  if (stage === "payment") {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-hero eth-pattern-strong px-4 py-10">
        <div className="glass-strong w-full max-w-lg animate-fade-up p-8">
          <h1 className="text-2xl font-semibold">Welcome, {payInfo?.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One step left: pay the one-time registration fee, then upload your payment screenshot.
            Our AI double-checks your screenshot against what you type.
          </p>
          <div className="mt-4 rounded-2xl border border-gold/40 bg-accent/60 p-4 backdrop-blur">
            <div className="font-display text-2xl font-bold text-primary">{payInfo?.fee.toLocaleString()} ETB</div>
            <div className="mt-2 space-y-1 text-sm">
              {payInfo?.telebirr && <div>📱 Telebirr: <span className="font-bold">{payInfo.telebirr}</span></div>}
              {payInfo?.bankAccounts.map((b) => <div key={b}>🏦 {b}</div>)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Pay with Telebirr, CBE Birr or bank transfer, then upload the screenshot below.</p>
          </div>
          <div className="mt-4 space-y-3">
            <input placeholder="Transaction ID *" value={txn} onChange={(e) => setTxn(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <input type="number" placeholder="Amount paid (ETB) *" value={amount} onChange={(e) => setAmount(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <input placeholder="Account / phone you paid from" value={account} onChange={(e) => setAccount(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2" />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm font-semibold text-muted-foreground hover:border-primary">
              📷 {shot ? shot.name : "Upload payment screenshot from your gallery"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setShot(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={() => sendProof("registration")} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-3 text-sm font-bold text-gold-foreground disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send proof to the manager
            </button>
            <p className="text-center text-xs text-muted-foreground">
              AI checks the screenshot instantly. If the manager doesn't review within 1 minute, the system approves it automatically.
            </p>
            <button onClick={() => setStage("entry")} className="w-full text-center text-xs font-bold text-muted-foreground">← Use a different FAN</button>
          </div>
        </div>
      </div>
    );
  }

  const checkupCount = portal?.checkups.length ?? 0;
  const unpaidCases = (portal?.cases ?? []).filter(
    (c: { payment_status?: string; service_fee?: number }) => (c.payment_status ?? "none") === "none" && Number(c.service_fee ?? 0) > 0,
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {portal?.hospital.logo ? (
            <img src={portal.hospital.logo} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero text-primary-foreground"><HeartPulse className="h-5 w-5" /></div>
          )}
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">{portal?.hospital.name ?? "Ambo General Hospital"}</h1>
            <p className="text-xs text-muted-foreground">
              Patient Portal · {portal?.patient.full_name}
              {portal?.patient.has_insurance && <span className="ml-2 inline-flex items-center gap-1 text-success"><ShieldCheck className="h-3 w-3" /> Insured</span>}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block"><HospitalClock hospitalId={portal?.hospital.id} /></div>
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {checkupCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-soft-pulse">{checkupCount}</span>}
            </div>
            <button onClick={() => { setStage("entry"); setFan(""); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border" aria-label="Exit"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="gold-divider" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <BackgroundCarousel hospitalId={portal?.hospital.id} height="h-44" />

        {/* Service payments due */}
        {unpaidCases.map((c: { id: string; title: string; service_fee: number; service_description?: string; rooms?: { name?: string } }) => (
          <div key={c.id} className="glass border-terracotta/40 p-5 ring-2 ring-terracotta/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-terracotta">💳 Payment required — {c.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {c.service_description ?? "Doctor-prescribed nursing / medicine service"} in {c.rooms?.name ?? "your room"}.
                </p>
                <p className="mt-1 font-display text-2xl font-bold">{Number(c.service_fee).toLocaleString()} ETB</p>
              </div>
              <button
                onClick={() => {
                  setPayingService({ kind: "service", caseId: c.id, fee: Number(c.service_fee), description: c.service_description ?? c.title });
                  setAmount(String(c.service_fee));
                  setTxn(""); setAccount(""); setShot(null);
                }}
                className="rounded-xl gradient-gold px-4 py-2 text-sm font-bold text-gold-foreground"
              >
                Pay now
              </button>
            </div>
          </div>
        ))}

        {payingService && (
          <div className="glass-strong animate-fade-up p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Send service payment proof</h3>
              <button onClick={() => setPayingService(null)} className="text-xs font-bold text-muted-foreground">✕ Cancel</button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pay <span className="font-bold text-foreground">{payingService.fee.toLocaleString()} ETB</span> for {payingService.description}.
              The amount must match exactly.
            </p>
            <div className="mt-3 rounded-xl border border-gold/40 bg-accent/60 p-3 text-sm backdrop-blur">
              {portal?.hospital.telebirr && <div>📱 Telebirr: <span className="font-bold">{portal.hospital.telebirr}</span></div>}
              {portal?.hospital.bankAccounts.map((b: string) => <div key={b}>🏦 {b}</div>)}
            </div>
            <div className="mt-3 space-y-3">
              <input placeholder="Transaction ID *" value={txn} onChange={(e) => setTxn(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 text-sm" />
              <input type="number" placeholder="Amount paid (ETB) *" value={amount} onChange={(e) => setAmount(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 text-sm" />
              <input placeholder="Account / phone you paid from" value={account} onChange={(e) => setAccount(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 text-sm" />
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm font-semibold text-muted-foreground hover:border-primary">
                📷 {shot ? shot.name : "Upload payment screenshot"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setShot(e.target.files?.[0] ?? null)} />
              </label>
              <button
                onClick={() => sendProof("service", payingService.caseId)}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-3 text-sm font-bold text-gold-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify & send
              </button>
            </div>
          </div>
        )}

        {/* Checkup alerts */}
        {(portal?.checkups ?? []).map((c: { id: string; checkup_date: string; note?: string; rooms?: { name?: string } }) => (
          <div key={c.id} className="glass flex items-center gap-3 border-gold/50 p-4 ring-2 ring-gold/40">
            <span className="h-3 w-3 rounded-full bg-gold animate-soft-pulse" />
            <div className="text-sm">
              <span className="font-bold">Checkup on {c.checkup_date}</span> in {c.rooms?.name ?? "your room"}.{" "}
              <span className="text-muted-foreground">{c.note}</span>
            </div>
          </div>
        ))}

        {/* Notifications */}
        <div className="glass p-6">
          <h2 className="font-display text-lg font-bold">Notifications</h2>
          <div className="mt-3 space-y-2">
            {(portal?.notifications ?? []).slice(0, 6).map((n: { id: string; title: string; body: string; kind: string }) => (
              <div key={n.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.kind === "alert" ? "bg-destructive" : n.kind === "success" ? "bg-success" : "bg-gold"}`} />
                <div><span className="font-semibold">{n.title}</span> <span className="text-xs text-muted-foreground">— {n.body}</span></div>
              </div>
            ))}
            {(portal?.notifications ?? []).length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
          </div>
        </div>

        {/* Open my case */}
        <button
          onClick={() => setShowCase((s) => !s)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-hero px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-elegant transition-transform hover:scale-[1.01]"
        >
          <FolderOpen className="h-5 w-5" /> {showCase ? "Close my case" : "Open my case"}
        </button>

        {showCase && (
          <div className="glass-strong animate-fade-up p-6">
            <h2 className="font-display text-lg font-bold">Case history</h2>
            <div className="mt-4 space-y-4">
              {(portal?.cases ?? []).map((c: {
                id: string;
                title: string;
                created_at: string;
                rooms?: { name?: string };
                diagnosis?: string;
                notes?: string;
                prescriptions?: string;
                service_fee?: number;
                payment_status?: string;
                case_attachments?: { id: string; file_type: string; signed: string | null; file_name: string }[];
              }) => (
                <div key={c.id} className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()} · {c.rooms?.name ?? ""}</span>
                  </div>
                  {c.diagnosis && <p className="mt-1 text-sm"><span className="font-bold">Diagnosis:</span> {c.diagnosis}</p>}
                  {c.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
                  {c.prescriptions && <p className="mt-2 whitespace-pre-line rounded-lg bg-muted p-2 text-sm">💊 {c.prescriptions}</p>}
                  {Number(c.service_fee ?? 0) > 0 && (
                    <p className={`mt-2 rounded-lg px-2 py-1 text-xs font-bold ${c.payment_status === "approved" ? "bg-success/15 text-success" : c.payment_status === "waived" ? "bg-primary/10 text-primary" : c.payment_status === "pending" ? "bg-gold/20 text-foreground" : "bg-terracotta/15 text-terracotta"}`}>
                      💳 Service fee: {Number(c.service_fee).toLocaleString()} ETB — {c.payment_status ?? "unpaid"}
                    </p>
                  )}
                  {c.case_attachments && c.case_attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.case_attachments.map((a) =>
                        a.file_type === "image" && a.signed ? (
                          <a key={a.id} href={a.signed} target="_blank" rel="noreferrer"><img src={a.signed} alt={a.file_name} loading="lazy" className="h-16 w-16 rounded-lg object-cover" /></a>
                        ) : (
                          <a key={a.id} href={a.signed ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-semibold"><FileText className="h-3.5 w-3.5" /> {a.file_name}</a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
              {(portal?.cases ?? []).length === 0 && <p className="text-sm text-muted-foreground">No case records yet.</p>}
            </div>
          </div>
        )}

        <AIAssistant
          actor="patient"
          context={
            portal
              ? `Patient: ${portal.patient.full_name}${portal.patient.has_insurance ? " (insured)" : ""}. Cases: ${portal.cases.map((c: { title: string; diagnosis?: string; prescriptions?: string }) => `${c.title}: ${c.diagnosis ?? ""} ${c.prescriptions ?? ""}`).join(" | ")}. Upcoming checkups: ${portal.checkups.map((c: { checkup_date: string }) => c.checkup_date).join(", ")}`
              : undefined
          }
        />
      </main>
    </div>
  );
}
