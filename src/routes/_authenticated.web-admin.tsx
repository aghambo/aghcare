import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  CalendarClock,
  DoorOpen,
  Mail,
  MessageSquare,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/lib/media";
import { PortalShell } from "@/components/PortalShell";
import { AIAssistant } from "@/components/AIAssistant";
import { Countdown } from "@/components/Countdown";
import { addAuthorized, listAccounts, removeActiveUser, removeAuthorized } from "@/lib/admin.functions";
import { t, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/web-admin")({
  head: () => ({ meta: [{ title: "Web Admin — IB Tech E-Health" }] }),
  component: WebAdminPortal,
});

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string | number; tone?: string }) {
  return (
    <div className="card-panel eth-pattern p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone ?? "gradient-hero"} text-primary-foreground`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function WebAdminPortal() {
  const queryClient = useQueryClient();
  const { data: hospital } = useHospital();

  const { data: stats } = useQuery({
    queryKey: ["web-admin-stats"],
    queryFn: async () => {
      const [rooms, patients, pending] = await Promise.all([
        supabase.from("rooms").select("*", { count: "exact", head: true }),
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return { rooms: rooms.count ?? 0, patients: patients.count ?? 0, pending: pending.count ?? 0 };
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["all-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("*").order("created_at");
      return data ?? [];
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  // ------- Hospital setup form -------
  const [adminEmail, setAdminEmail] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [years, setYears] = useState("1");
  const [roomLimit, setRoomLimit] = useState("100");
  const [telebirr, setTelebirr] = useState("");
  const [banks, setBanks] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (hospital && !initialized) {
    setAdminEmail(hospital.admin_email ?? "");
    setBasePrice(String(hospital.base_price ?? ""));
    setYears(String(hospital.subscription_years ?? 1));
    setRoomLimit(String(hospital.room_limit ?? 100));
    setTelebirr(hospital.telebirr_number ?? "");
    setBanks(((hospital.bank_accounts as string[] | null) ?? []).join("\n"));
    setInitialized(true);
  }

  const base = parseFloat(basePrice) || 0;
  const yrs = Math.max(1, parseInt(years) || 1);
  const additional = 0.05 * base * yrs;
  const total = base + additional * yrs;

  const saveSetup = useMutation({
    mutationFn: async () => {
      if (!hospital) return;
      const email = adminEmail.trim().toLowerCase();
      const { error } = await supabase
        .from("hospitals")
        .update({
          admin_email: email || null,
          base_price: base,
          subscription_years: yrs,
          room_limit: parseInt(roomLimit) || 100,
          telebirr_number: telebirr.trim() || null,
          bank_accounts: banks.split("\n").map((b) => b.trim()).filter(Boolean),
        })
        .eq("id", hospital.id);
      if (error) throw error;
      if (email) {
        await supabase.from("authorized_emails").delete().eq("role", "hospital_admin");
        const { data: me } = await supabase.auth.getUser();
        const { error: aeErr } = await supabase
          .from("authorized_emails")
          .insert({ email, role: "hospital_admin", created_by: me.user?.id });
        if (aeErr && !aeErr.message.includes("duplicate")) throw aeErr;
      }
    },
    onSuccess: () => {
      toast.success("Hospital setup saved. The admin email is now authorized to sign in.");
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const activateService = useMutation({
    mutationFn: async () => {
      if (!hospital) return;
      const start = new Date();
      const end = new Date(start.getTime() + yrs * 365 * 86400000);
      const { error } = await supabase
        .from("hospitals")
        .update({
          service_active: true,
          payment_confirmed: true,
          service_start: start.toISOString(),
          service_end: end.toISOString(),
        })
        .eq("id", hospital.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service activated! The countdown has started.");
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <PortalShell
      title="Web Admin / Owner"
      subtitle="IB Tech E-Health Platform · Platform command center"
      requiredRole="web_admin"
    >
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DoorOpen} label="Rooms registered" value={stats?.rooms ?? "—"} />
        <StatCard icon={Users} label="Patients" value={stats?.patients ?? "—"} />
        <StatCard icon={Banknote} label="Payments awaiting review" value={stats?.pending ?? "—"} tone="bg-terracotta" />
        <StatCard
          icon={ShieldCheck}
          label="Service status"
          value={hospital?.service_active ? "Active" : "Inactive"}
          tone={hospital?.service_active ? "bg-success" : "bg-muted-foreground"}
        />
      </div>

      {/* Countdown */}
      {hospital?.service_active && hospital.service_end && (
        <div className="card-panel flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-lg font-bold">Service countdown</h2>
            <p className="text-xs text-muted-foreground">
              Active since {new Date(hospital.service_start!).toLocaleDateString()} · ends{" "}
              {new Date(hospital.service_end).toLocaleDateString()}
            </p>
          </div>
          <Countdown end={hospital.service_end} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hospital setup */}
        <div className="card-panel p-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Hospital onboarding & setup</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-muted-foreground">
              <span className="mb-1 flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Official hospital admin login email</span>
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="director@ambohospital.et"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-muted-foreground">
                Yearly base price (ETB, 100 rooms)
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
                />
              </label>
              <label className="block text-xs font-bold text-muted-foreground">
                Duration (years)
                <input
                  type="number"
                  min={1}
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
                />
              </label>
              <label className="block text-xs font-bold text-muted-foreground">
                Room limit
                <input
                  type="number"
                  value={roomLimit}
                  onChange={(e) => setRoomLimit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
                />
              </label>
              <label className="block text-xs font-bold text-muted-foreground">
                Telebirr number
                <input
                  value={telebirr}
                  onChange={(e) => setTelebirr(e.target.value)}
                  placeholder="09XXXXXXXX"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-muted-foreground">
              Bank accounts shown to the hospital (one per line)
              <textarea
                value={banks}
                onChange={(e) => setBanks(e.target.value)}
                rows={3}
                placeholder={"CBE — 1000123456789\nAwash Bank — 0134567890"}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
              />
            </label>

            {/* Pricing calculator */}
            <div className="rounded-2xl border border-gold/40 bg-accent p-4 text-sm">
              <div className="font-bold text-accent-foreground">Subscription calculation</div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Base package (100 rooms · 1 year)</span><span className="font-bold text-foreground">{base.toLocaleString()} ETB</span></div>
                <div className="flex justify-between"><span>Additional room price (5% × base × {yrs} yr)</span><span className="font-bold text-foreground">{additional.toLocaleString()} ETB</span></div>
                <div className="gold-divider my-2" />
                <div className="flex justify-between text-sm"><span className="font-bold">Final total (base + additional × {yrs})</span><span className="font-display text-base font-bold text-primary">{total.toLocaleString()} ETB</span></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => saveSetup.mutate()}
                disabled={saveSetup.isPending}
                className="flex items-center gap-2 rounded-xl gradient-hero px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-card disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Save setup
              </button>
              {!hospital?.service_active && (
                <button
                  onClick={() => activateService.mutate()}
                  disabled={activateService.isPending || !base}
                  className="flex items-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-card disabled:opacity-60"
                >
                  <CalendarClock className="h-4 w-4" /> Confirm payment & activate service
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AI + comms */}
        <div className="space-y-6">
          <AIAssistant
            actor="web_admin"
            context={`Hospital: ${hospital?.name}. Service active: ${hospital?.service_active}. Rooms: ${stats?.rooms}. Patients: ${stats?.patients}. Pending payments: ${stats?.pending}. Base price: ${hospital?.base_price} ETB, years: ${hospital?.subscription_years}, room limit: ${hospital?.room_limit}.`}
          />
          <Link
            to="/messages"
            className="card-panel flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-terracotta text-terracotta-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Hospital conversation</div>
              <div className="text-xs text-muted-foreground">
                Telegram-style chat with the hospital director — text, images, voice, PDFs & files
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Rooms overview */}
      <div className="card-panel p-6">
        <h2 className="font-display text-lg font-bold">All hospital rooms</h2>
        <p className="text-xs text-muted-foreground">Every room created by the hospital admin is visible here.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Room ID</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {(rooms ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4 font-semibold">{r.name}</td>
                  <td className="py-2.5 pr-4 capitalize">{r.room_type}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{r.room_code}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {r.active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(rooms ?? []).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No rooms created yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="card-panel p-6">
        <h2 className="font-display text-lg font-bold">Activity timeline</h2>
        <div className="mt-4 space-y-3">
          {(auditLogs ?? []).map((l) => (
            <div key={l.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
              <div>
                <span className="font-semibold">{l.action.replace(/_/g, " ")}</span>
                <span className="ml-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {(auditLogs ?? []).length === 0 && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
        </div>
      </div>
    </PortalShell>
  );
}
