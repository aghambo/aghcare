import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  Crown,
  HeartPulse,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import heroImage from "@/assets/hero-ethiopian.jpg";
import ibTechLogo from "@/assets/ib-tech-logo.png.asset.json";
import { LanguageSwitcher, t, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IB Tech E-Health — Ambo General Hospital Platform" },
      {
        name: "description",
        content:
          "The complete hospital operating system for Ambo General Hospital: patient care, rooms, payments, secure communication and AI — in one elegant Ethiopian-inspired platform.",
      },
    ],
  }),
  component: Landing,
});

const roles = [
  {
    icon: Crown,
    title: "Web Admin / Owner",
    desc: "Platform ownership, hospital onboarding, pricing, service countdown and global oversight.",
    to: "/auth",
    search: { role: "web_admin" },
  },
  {
    icon: Building2,
    title: "Hospital Admin / Director",
    desc: "Branding, room control, payment rules, patient data governance and operations AI.",
    to: "/auth",
    search: { role: "hospital_admin" },
  },
  {
    icon: Users,
    title: "Hospital Manager",
    desc: "Patient registration, payment approvals, room assignment and the live care queue.",
    to: "/auth",
    search: { role: "manager" },
  },
  {
    icon: Stethoscope,
    title: "Doctor's Room",
    desc: "Secure room access with patient queue, case history, prescriptions and follow-ups.",
    to: "/doctor",
    search: undefined,
  },
  {
    icon: UserRound,
    title: "Patient",
    desc: "Open your case with your FAN number — history, prescriptions, checkups and AI help.",
    to: "/patient",
    search: undefined,
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Role-based security",
    desc: "Email-verified access, permission checks on every action, and a full audit trail.",
  },
  {
    icon: Activity,
    title: "Live hospital workflow",
    desc: "From registration fee to room queue to follow-up checkups — one connected timeline.",
  },
  {
    icon: MessageSquare,
    title: "Secure communication",
    desc: "Telegram-style conversations with text, images, voice, PDFs and file previews.",
  },
  {
    icon: Sparkles,
    title: "AI for every role",
    desc: "Summaries, pattern detection and plain-language explanations for staff and patients.",
  },
];

function Landing() {
  const [lang] = useLang();
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Ethiopian-inspired woven gold pattern"
          width={1920}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />
        <div className="absolute right-6 top-6 z-10"><LanguageSwitcher /></div>
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-6 py-24">
          <div className="animate-fade-up">
            <div className="flex items-center gap-4">
              <img
                src={ibTechLogo.url}
                alt="IB Tech — Innovate. Build. Grow."
                className="h-16 w-16 rounded-2xl bg-white/95 p-1.5 shadow-elegant ring-1 ring-gold/40 md:h-20 md:w-20"
              />
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/30 px-4 py-1.5 text-sm font-semibold tracking-wide text-gold backdrop-blur">
                <HeartPulse className="h-4 w-4" />
                {t("app.title", lang)} · 🇪🇹
              </div>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-primary-foreground md:text-6xl">
              {t("landing.hero.tagline", lang)}
            </h1>
            <p className="mt-3 max-w-2xl font-display text-lg italic text-gold/90">
              እንኳን ደህና መጡ · Baga nagaan dhufte · Welcome to Ambo General Hospital
            </p>
            <p className="mt-5 max-w-2xl text-lg text-primary-foreground/85">
              A complete hospital operating system — patient registration, payment approval, room
              control, case management, secure communication and intelligent AI assistance, wrapped
              in a modern Ethiopian visual identity.
            </p>
            <div className="mt-6 gold-divider w-40" />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-xl gradient-gold px-6 py-3 text-sm font-bold text-gold-foreground shadow-elegant transition-transform hover:scale-[1.03]"
              >
                {t("landing.enterPortal", lang)}
              </Link>
              <Link
                to="/patient"
                className="rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-6 py-3 text-sm font-bold text-primary-foreground backdrop-blur transition-colors hover:bg-primary-foreground/20"
              >
                {t("landing.iAmPatient", lang)}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Role selection */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold md:text-4xl">{t("landing.chooseRole", lang)}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Five dedicated portals, each with its own permissions, dashboard and workflow.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <Link
              key={r.title}
              to={r.to}
              search={r.search}
              className="group card-panel eth-pattern relative overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-card">
                <r.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
              <span className="mt-4 inline-block text-sm font-bold text-primary transition-transform group-hover:translate-x-1">
                Open portal →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="gradient-hero eth-pattern-strong py-20 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-semibold md:text-4xl">
            Built like a real hospital operating system
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 backdrop-blur transition-colors hover:bg-primary-foreground/10"
              >
                <f.icon className="h-7 w-7 text-gold" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-primary-foreground/75">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-card sm:grid-cols-3">
          {[
            ["100+", "Rooms per standard package"],
            ["5", "Dedicated role portals"],
            ["24/7", "AI-assisted operations"],
          ].map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="font-display text-4xl font-bold text-primary">{n}</div>
              <div className="mt-1 text-sm text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        <div className="gold-divider mx-auto mb-6 w-24" />
        IB Tech E-Health Platform · Ambo General Hospital · Built with excellence
      </footer>
    </div>
  );
}
