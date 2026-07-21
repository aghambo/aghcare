import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  DoorOpen,
  ImagePlus,
  MessageSquare,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital, useHospitalBackgrounds } from "@/lib/media";
import { PortalShell } from "@/components/PortalShell";
import { AIAssistant } from "@/components/AIAssistant";
import { Countdown } from "@/components/Countdown";
import { listAccounts, removeActiveUser, removeAuthorized } from "@/lib/admin.functions";
import { t, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/hospital-admin")({
  head: () => ({ meta: [{ title: "Hospital Admin — Ambo General Hospital" }] }),
  component: HospitalAdminPortal,
});

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "AGH-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function HospitalAdminPortal() {
  const queryClient = useQueryClient();
  const { data: hospital } = useHospital();
  const { data: backgrounds } = useHospitalBackgrounds(hospital?.id);
  const [lang] = useLang();
  const listAccountsFn = useServerFn(listAccounts);
  const rmAuthFn = useServerFn(removeAuthorized);
  const rmActiveFn = useServerFn(removeActiveUser);

  const { data: accounts } = useQuery({
    queryKey: ["accounts", "hospital_admin"],
    queryFn: () => listAccountsFn(),
  });

  const rmAuth = useMutation({
    mutationFn: (id: string) => rmAuthFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Authorization removed");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rmActive = useMutation({
    mutationFn: (userRoleId: string) => rmActiveFn({ data: { userRoleId } }),
    onSuccess: () => {
      toast.success("Manager access revoked");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: rooms } = useQuery({
    queryKey: ["all-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("*").order("created_at");
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["ha-stats"],
    queryFn: async () => {
      const [patients, active, pending] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return { patients: patients.count ?? 0, active: active.count ?? 0, pending: pending.count ?? 0 };
    },
  });

  // ---- branding uploads ----
  const uploadLogo = async (file: File) => {
    if (!hospital) return;
    const path = `logo/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("hospital-media").upload(path, file);
    if (error) return toast.error("Logo upload failed");
    await supabase.from("hospitals").update({ logo_url: path }).eq("id", hospital.id);
    toast.success("Logo updated");
    queryClient.invalidateQueries({ queryKey: ["hospital"] });
  };

  const uploadBackground = async (file: File) => {
    if (!hospital) return;
    const path = `backgrounds/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("hospital-media").upload(path, file);
    if (error) return toast.error("Background upload failed");
    await supabase.from("hospital_media").insert({
      hospital_id: hospital.id,
      url: path,
      media_type: "background",
      sort_order: (backgrounds?.length ?? 0) + 1,
    });
    toast.success("Background added — it now rotates across all portals");
    queryClient.invalidateQueries({ queryKey: ["hospital-backgrounds"] });
  };

  const deleteBackground = async (id: string, path: string) => {
    await supabase.from("hospital_media").delete().eq("id", id);
    await supabase.storage.from("hospital-media").remove([path]);
    queryClient.invalidateQueries({ queryKey: ["hospital-backgrounds"] });
    toast.success("Background removed");
  };

  // ---- room creation ----
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState<"doctor" | "manager">("doctor");

  const createRoom = useMutation({
    mutationFn: async () => {
      if (!hospital) throw new Error("Hospital not loaded");
      if ((rooms?.length ?? 0) >= hospital.room_limit) {
        throw new Error(`Room limit reached (${hospital.room_limit}). Contact the Web Admin to expand your package.`);
      }
      const { error } = await supabase.from("rooms").insert({
        hospital_id: hospital.id,
        name: roomName.trim(),
        room_type: roomType,
        room_code: genRoomCode(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room created — share the Room ID with the staff who will use it.");
      setRoomName("");
      queryClient.invalidateQueries({ queryKey: ["all-rooms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleRoom = async (id: string, active: boolean) => {
    await supabase.from("rooms").update({ active: !active }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["all-rooms"] });
  };

  // ---- registration fee & payment info ----
  const [fee, setFee] = useState("");
  const [banks, setBanks] = useState("");
  const [telebirr, setTelebirr] = useState("");
  const [feeInit, setFeeInit] = useState(false);
  if (hospital && !feeInit) {
    setFee(String(hospital.registration_fee ?? ""));
    setBanks(((hospital.bank_accounts as string[] | null) ?? []).join("\n"));
    setTelebirr(hospital.telebirr_number ?? "");
    setFeeInit(true);
  }

  const saveFee = useMutation({
    mutationFn: async () => {
      if (!hospital) return;
      const { error } = await supabase
        .from("hospitals")
        .update({
          registration_fee: parseFloat(fee) || 0,
          bank_accounts: banks.split("\n").map((b) => b.trim()).filter(Boolean),
          telebirr_number: telebirr.trim() || null,
        })
        .eq("id", hospital.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment settings saved — patients now see this information.");
      queryClient.invalidateQueries({ queryKey: ["hospital"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // ---- manager authorization ----
  const [managerEmail, setManagerEmail] = useState("");
  const authorizeManager = useMutation({
    mutationFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("authorized_emails").insert({
        email: managerEmail.trim().toLowerCase(),
        role: "manager",
        created_by: me.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manager email authorized — they can now sign in.");
      setManagerEmail("");
    },
    onError: (e) => toast.error(e.message.includes("duplicate") ? "That email is already authorized." : e.message),
  });

  return (
    <PortalShell
      title={hospital?.name ?? "Ambo General Hospital"}
      subtitle="Hospital Admin / Director · Operations control"
      requiredRole="hospital_admin"
    >
      {/* Stats + countdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-panel eth-pattern p-5">
          <Users className="h-6 w-6 text-primary" />
          <div className="mt-2 font-display text-2xl font-bold">{stats?.patients ?? "—"}</div>
          <div className="text-xs font-semibold text-muted-foreground">Registered patients</div>
        </div>
        <div className="card-panel eth-pattern p-5">
          <Users className="h-6 w-6 text-success" />
          <div className="mt-2 font-display text-2xl font-bold">{stats?.active ?? "—"}</div>
          <div className="text-xs font-semibold text-muted-foreground">Fully approved</div>
        </div>
        <div className="card-panel eth-pattern p-5">
          <DoorOpen className="h-6 w-6 text-terracotta" />
          <div className="mt-2 font-display text-2xl font-bold">
            {rooms?.length ?? 0}/{hospital?.room_limit ?? 100}
          </div>
          <div className="text-xs font-semibold text-muted-foreground">Rooms used</div>
        </div>
        <div className="card-panel eth-pattern p-5">
          <Banknote className="h-6 w-6 text-gold" />
          <div className="mt-2 font-display text-2xl font-bold">{stats?.pending ?? "—"}</div>
          <div className="text-xs font-semibold text-muted-foreground">Payments in queue</div>
        </div>
      </div>

      {hospital?.service_active && hospital.service_end ? (
        <div className="card-panel flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-lg font-bold">Service time remaining</h2>
            <p className="text-xs text-muted-foreground">Yearly package · {hospital.subscription_years} year(s)</p>
          </div>
          <Countdown end={hospital.service_end} />
        </div>
      ) : (
        <div className="card-panel border-terracotta/40 p-6 text-sm">
          <span className="font-bold text-terracotta">Service not yet activated.</span>{" "}
          The Web Admin activates your service after payment confirmation.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branding & media */}
        <div className="card-panel p-6">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Branding & visual media</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload your logo and at least five background images — they rotate every few seconds on the
            admin, manager and patient portals.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl gradient-hero px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-card">
              <Upload className="h-4 w-4" /> Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-gold-foreground shadow-card">
              <ImagePlus className="h-4 w-4" /> Add background image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])} />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(backgrounds ?? []).map((b) => (
              <div key={b.id} className="group relative overflow-hidden rounded-xl">
                <img src={b.signed as string} alt="Background" className="h-20 w-full object-cover" loading="lazy" />
                <button
                  onClick={() => deleteBackground(b.id, b.url)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-5 w-5 text-white" />
                </button>
              </div>
            ))}
            {(backgrounds ?? []).length === 0 && (
              <p className="col-span-3 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No backgrounds yet — the default image is shown.
              </p>
            )}
          </div>
        </div>

        {/* Room management */}
        <div className="card-panel p-6">
          <div className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Room management</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name (e.g. Internal Medicine 1)"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2"
            />
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value as "doctor" | "manager")}
              className="rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
            >
              <option value="doctor">Doctor room</option>
              <option value="manager">Manager room</option>
            </select>
            <button
              onClick={() => roomName.trim() && createRoom.mutate()}
              disabled={createRoom.isPending || !roomName.trim()}
              className="flex items-center gap-1 rounded-xl gradient-hero px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {(rooms ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="capitalize">{r.room_type}</span> · Room ID:{" "}
                    <span className="font-mono font-bold text-foreground">{r.room_code}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleRoom(r.id, r.active)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${r.active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                >
                  {r.active ? "Active" : "Deactivated"}
                </button>
              </div>
            ))}
            {(rooms ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No rooms yet. Create your first room above.
              </p>
            )}
          </div>
        </div>

        {/* Payment settings */}
        <div className="card-panel p-6">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Patient registration fee</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-muted-foreground">
              One-time registration fee (ETB)
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
              />
            </label>
            <label className="block text-xs font-bold text-muted-foreground">
              Telebirr number shown to patients
              <input
                value={telebirr}
                onChange={(e) => setTelebirr(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
              />
            </label>
            <label className="block text-xs font-bold text-muted-foreground">
              Hospital bank accounts (one per line)
              <textarea
                value={banks}
                onChange={(e) => setBanks(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none ring-ring focus:ring-2"
              />
            </label>
            <button
              onClick={() => saveFee.mutate()}
              disabled={saveFee.isPending}
              className="rounded-xl gradient-hero px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              Save payment settings
            </button>
          </div>
        </div>

        {/* Manager authorization + comms */}
        <div className="space-y-6">
          <div className="card-panel p-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Authorize a hospital manager</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Only authorized emails can enter the manager portal.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="manager@ambohospital.et"
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2"
              />
              <button
                onClick={() => managerEmail.trim() && authorizeManager.mutate()}
                disabled={authorizeManager.isPending}
                className="rounded-xl gradient-gold px-4 py-2.5 text-sm font-bold text-gold-foreground disabled:opacity-60"
              >
                Authorize
              </button>
            </div>
          </div>

          <Link
            to="/messages"
            className="card-panel flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-terracotta text-terracotta-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Message the Web Admin</div>
              <div className="text-xs text-muted-foreground">Secure conversation with attachments</div>
            </div>
          </Link>

          <AIAssistant
            actor="hospital_admin"
            context={`Hospital: ${hospital?.name}. Patients: ${stats?.patients} (${stats?.active} active). Rooms: ${rooms?.length}/${hospital?.room_limit}. Registration fee: ${hospital?.registration_fee} ETB. Pending payments: ${stats?.pending}.`}
          />
        </div>
      </div>

      {/* Manager roster */}
      <div className="card-panel p-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">{t("admin.userManagement", lang)} · {t("role.manager", lang)}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Review every manager who can operate on Ambo General Hospital. Remove access instantly if a manager leaves.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-sm font-bold">Signed-in managers</h3>
            <div className="mt-2 space-y-2">
              {(accounts?.active ?? []).filter((a) => a.role === "manager").map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.email}</div>
                    <div className="text-xs text-muted-foreground">joined {new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(t("admin.confirmRemove", lang))) rmActive.mutate(a.id);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t("common.remove", lang)}
                  </button>
                </div>
              ))}
              {(accounts?.active ?? []).filter((a) => a.role === "manager").length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No managers signed in yet.
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">Invited managers (not yet signed in)</h3>
            <div className="mt-2 space-y-2">
              {(accounts?.authorized ?? []).filter((a) => a.role === "manager").map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(t("admin.confirmRemove", lang))) rmAuth.mutate(a.id);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {(accounts?.authorized ?? []).filter((a) => a.role === "manager").length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No pending manager invitations.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
