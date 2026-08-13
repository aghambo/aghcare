import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Crown, Loader2, Stethoscope, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ibTechLogo from "@/assets/ib-tech-logo.png.asset.json";
import { lovable } from "@/integrations/lovable/index";
import { bootstrapUser } from "@/lib/auth.functions";
import { ROLE_HOME, ROLE_LABELS, type AppRole } from "@/lib/roles";

type AuthSearch = { role?: string; redirect?: string };

/** Keeps a same-origin post-login destination (e.g. the OAuth consent screen) through auth round-trips. */
function authReturnPath(redirectTo?: string) {
  return redirectTo && redirectTo.startsWith("/")
    ? `/auth?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    role: typeof search.role === "string" ? search.role : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — IB Tech E-Health" },
      { name: "description", content: "Secure role-based access to the Ambo General Hospital platform." },
    ],
  }),
  component: AuthPage,
});

const staffRoles: { key: AppRole; icon: typeof Crown; desc: string }[] = [
  { key: "web_admin", icon: Crown, desc: "Platform owner — authorized email only" },
  { key: "hospital_admin", icon: Building2, desc: "Email approved by the Web Admin" },
  { key: "manager", icon: Users, desc: "Permissioned by the hospital admin" },
];

function AuthPage() {
  const { role: preselected, redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapUser);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(
    preselected && ["web_admin", "hospital_admin", "manager"].includes(preselected)
      ? (preselected as AppRole)
      : null,
  );
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const finishLogin = async () => {
    try {
      const result = await bootstrap();
      if (!result.role || !ROLE_HOME[result.role]) {
        toast.error("This email is not authorized for a staff portal. Access blocked.");
        await supabase.auth.signOut();
        return;
      }
      if (selectedRole && result.role !== selectedRole) {
        toast.info(`Your account is registered as ${ROLE_LABELS[result.role as AppRole]}. Redirecting you there.`);
      } else {
        toast.success("Welcome back!");
      }
      if (redirectTo && redirectTo.startsWith("/")) {
        window.location.href = redirectTo;
        return;
      }
      navigate({ to: ROLE_HOME[result.role] });
    } catch {
      toast.error("Could not verify your access. Please try again.");
    }
  };

  useEffect(() => {
    // If already signed in, route straight to the correct portal
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finishLogin();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + authReturnPath(redirectTo) },
        });
        if (error) throw error;
        toast.success("Account created. If email confirmation is required, check your inbox — then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await finishLogin();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + authReturnPath(redirectTo),
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    await finishLogin();
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-hero eth-pattern-strong px-4 py-12">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="text-center">
          <img
            src={ibTechLogo.url}
            alt="IB Tech"
            className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white/95 p-2 shadow-elegant ring-1 ring-gold/40"
          />
          <h1 className="text-3xl font-semibold text-primary-foreground">IB Tech E-Health</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">Ambo General Hospital · Secure portal access</p>
          <div className="gold-divider mx-auto mt-4 w-24" />
        </div>

        <div className="card-panel mt-8 p-6 md:p-8">
          {!selectedRole ? (
            <>
              <h2 className="text-lg font-semibold">Select your role</h2>
              <div className="mt-4 space-y-3">
                {staffRoles.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setSelectedRole(r.key)}
                    className="flex w-full items-center gap-4 rounded-xl border border-border p-4 text-left transition-all hover:border-primary hover:shadow-card"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg gradient-hero text-primary-foreground">
                      <r.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{ROLE_LABELS[r.key]}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => navigate({ to: "/doctor" })}
                  className="flex w-full items-center gap-4 rounded-xl border border-border p-4 text-left transition-all hover:border-primary hover:shadow-card"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-terracotta text-terracotta-foreground">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Doctor's Room</div>
                    <div className="text-xs text-muted-foreground">Enter with your generated Room ID</div>
                  </div>
                </button>
                <button
                  onClick={() => navigate({ to: "/patient" })}
                  className="flex w-full items-center gap-4 rounded-xl border border-border p-4 text-left transition-all hover:border-primary hover:shadow-card"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg gradient-gold text-gold-foreground">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Patient</div>
                    <div className="text-xs text-muted-foreground">Enter with your FAN / Fayda number</div>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedRole(null)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                ← Change role
              </button>
              <h2 className="mt-2 text-lg font-semibold">{ROLE_LABELS[selectedRole]}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Only the authorized email registered for this role can enter. Unauthorized accounts are blocked.
              </p>

              <form onSubmit={handleEmailAuth} className="mt-5 space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Authorized email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-ring focus:ring-2"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none ring-ring focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl gradient-hero px-4 py-3 text-sm font-bold text-primary-foreground shadow-card transition-transform hover:scale-[1.01] disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <button
                onClick={handleGoogle}
                disabled={busy}
                className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
              >
                Continue with Google
              </button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    First time here?{" "}
                    <button className="font-bold text-primary" onClick={() => setMode("signup")}>
                      Create your account
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{" "}
                    <button className="font-bold text-primary" onClick={() => setMode("signin")}>
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
