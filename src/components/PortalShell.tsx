import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, HeartPulse, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital, useHospitalBackgrounds, useSignedUrl } from "@/lib/media";
import { useAuth } from "@/lib/useAuth";
import { HospitalClock } from "@/components/HospitalClock";
import defaultBg from "@/assets/hospital-default-bg.jpg";

export function BackgroundCarousel({ hospitalId, height = "h-56" }: { hospitalId?: string; height?: string }) {
  const { data: backgrounds } = useHospitalBackgrounds(hospitalId);
  const [idx, setIdx] = useState(0);
  const urls =
    backgrounds && backgrounds.length > 0 ? backgrounds.map((b) => b.signed as string) : [defaultBg];

  useEffect(() => {
    if (urls.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % urls.length), 5000);
    return () => clearInterval(t);
  }, [urls.length]);

  return (
    <div className={`relative w-full overflow-hidden rounded-3xl ${height}`}>
      {urls.map((u, i) => (
        <img
          key={u}
          src={u}
          alt="Hospital"
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === idx % urls.length ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
}

export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  const markAllRead = async () => {
    const ids = notifications?.filter((n) => !n.read).map((n) => n.id) ?? [];
    if (ids.length) {
      await supabase.from("notifications").update({ read: true }).in("id", ids);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-card transition-colors hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-soft-pulse">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-elegant">
          {(notifications ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {(notifications ?? []).map((n) => (
            <div key={n.id} className="rounded-xl p-3 hover:bg-muted">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${n.kind === "alert" ? "bg-destructive" : n.kind === "success" ? "bg-success" : "bg-gold"}`}
                />
                <span className="text-sm font-semibold">{n.title}</span>
              </div>
              {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortalShell({
  title,
  subtitle,
  children,
  requiredRole,
  showCarousel = true,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  requiredRole: "web_admin" | "hospital_admin" | "manager";
  showCarousel?: boolean;
}) {
  const { role, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { data: hospital } = useHospital();
  const { data: logoUrl } = useSignedUrl("hospital-media", hospital?.logo_url);

  useEffect(() => {
    if (!loading && role && role !== requiredRole) {
      navigate({ to: "/auth" });
    }
  }, [loading, role, requiredRole, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-soft-pulse font-display text-xl text-primary">Loading portal…</div>
      </div>
    );
  }

  if (role !== requiredRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-panel max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold">Access blocked</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user?.email}) is not authorized for this portal.
          </p>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="mt-4 rounded-xl gradient-hero px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Hospital logo" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero text-primary-foreground">
              <HeartPulse className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold leading-tight">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <HospitalClock hospitalId={hospital?.id} />
            </div>
            <NotificationsBell />
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-card transition-colors hover:bg-muted"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="gold-divider" />
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {showCarousel && <BackgroundCarousel hospitalId={hospital?.id} />}
        {children}
      </main>
    </div>
  );
}
