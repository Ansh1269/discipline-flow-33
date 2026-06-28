import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, Smartphone, Monitor, Download as DownloadIcon, Sparkles, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download DisciplineOS — iOS, Android, Windows apps" },
      { name: "description", content: "Get DisciplineOS on your device. Install the iOS and Android apps or download the Windows desktop app to track habits, routines, and discipline anywhere." },
      { property: "og:title", content: "Download DisciplineOS for iOS, Android, and Windows" },
      { property: "og:description", content: "Native iOS, Android, and Windows apps for the DisciplineOS productivity tracker." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

type Platform = "ios" | "android" | "windows";

const PLATFORMS: { id: Platform; label: string; icon: typeof Apple; tagline: string }[] = [
  { id: "ios", label: "iOS", icon: Apple, tagline: "iPhone & iPad" },
  { id: "android", label: "Android", icon: Smartphone, tagline: "Phones & tablets" },
  { id: "windows", label: "Windows", icon: Monitor, tagline: "Desktop app" },
];

function DownloadPage() {
  const [active, setActive] = useState<Platform>("ios");
  return (
    <main className="min-h-svh bg-gradient-to-b from-background to-background/60">
      <header className="px-6 pt-10 pb-6 max-w-5xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <Sparkles className="size-4 text-emerald" /> DisciplineOS
        </Link>
      </header>

      <section className="px-6 max-w-5xl mx-auto text-center pb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-5">
          <DownloadIcon className="size-3.5 text-emerald" /> Available on every device
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Get DisciplineOS on iOS, Android & Windows
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
          Build discipline anywhere. Install the native app on your phone or desktop and keep your routines, tasks, and habits in sync.
        </p>
      </section>

      <section className="px-6 max-w-5xl mx-auto pb-16">
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PLATFORMS.map(({ id, label, icon: Icon, tagline }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                aria-pressed={isActive}
                className={`glass rounded-2xl p-5 text-left transition border ${isActive ? "border-emerald/60 ring-2 ring-emerald/30" : "border-transparent hover:border-white/10"}`}
              >
                <Icon className={`size-6 mb-3 ${isActive ? "text-emerald" : "text-foreground"}`} />
                <div className="font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{tagline}</div>
              </button>
            );
          })}
        </div>

        <div className="glass rounded-3xl p-6 md:p-10 soft-shadow">
          {active === "ios" && <IosPanel />}
          {active === "android" && <AndroidPanel />}
          {active === "windows" && <WindowsPanel />}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Native iOS and Android builds are produced from this project's Capacitor configuration. Windows ships as an Electron desktop app.
        </p>
      </section>
    </main>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald text-white px-5 py-3 font-semibold soft-shadow hover:opacity-90 transition"
    >
      {children}
    </a>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 font-medium hover:bg-white/5 transition"
    >
      {children}
    </a>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="shrink-0 size-6 rounded-full bg-emerald/15 text-emerald grid place-items-center text-xs font-semibold">{i + 1}</span>
          <span className="text-muted-foreground pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function IosPanel() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">DisciplineOS for iPhone & iPad</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Install the iOS app through TestFlight, or add the web app to your home screen instantly — no App Store required.
        </p>
        <div className="flex flex-wrap gap-3 mb-6">
          <PrimaryButton href="https://testflight.apple.com/">
            <Apple className="size-4" /> Join TestFlight
          </PrimaryButton>
          <SecondaryButton href="https://discipline-flow-33.lovable.app/">
            <ExternalLink className="size-4" /> Open in Safari
          </SecondaryButton>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-emerald" /> Requires iOS 16 or later
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Add to Home Screen</h3>
        <StepList
          steps={[
            "Open discipline-flow-33.lovable.app in Safari on your iPhone or iPad.",
            "Tap the Share button at the bottom of the screen.",
            "Scroll down and tap 'Add to Home Screen'.",
            "Tap 'Add' — DisciplineOS launches like a native app, full screen.",
          ]}
        />
      </div>
    </div>
  );
}

function AndroidPanel() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">DisciplineOS for Android</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Download the Android app from Google Play, sideload the APK, or install the web app instantly from Chrome.
        </p>
        <div className="flex flex-wrap gap-3 mb-6">
          <PrimaryButton href="https://play.google.com/store/apps/">
            <Smartphone className="size-4" /> Get it on Google Play
          </PrimaryButton>
          <SecondaryButton href="https://discipline-flow-33.lovable.app/">
            <DownloadIcon className="size-4" /> Download APK
          </SecondaryButton>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-emerald" /> Requires Android 10 or later
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Install from the browser</h3>
        <StepList
          steps={[
            "Open discipline-flow-33.lovable.app in Chrome on your Android device.",
            "Tap the three-dot menu in the top right.",
            "Choose 'Install app' or 'Add to Home screen'.",
            "Confirm — DisciplineOS appears in your app drawer like any native app.",
          ]}
        />
      </div>
    </div>
  );
}

function WindowsPanel() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">DisciplineOS for Windows</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Run DisciplineOS as a real desktop app on Windows 10 or 11. The installer bundles an Electron shell that loads your account in a focused, distraction-free window.
        </p>
        <div className="flex flex-wrap gap-3 mb-6">
          <PrimaryButton href="/downloads/DisciplineOS-Setup-win-x64.zip">
            <DownloadIcon className="size-4" /> Download for Windows (64-bit)
          </PrimaryButton>
          <SecondaryButton href="https://discipline-flow-33.lovable.app/">
            <ExternalLink className="size-4" /> Use in browser instead
          </SecondaryButton>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-emerald" /> Windows 10 / 11 · ~95 MB
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">After downloading</h3>
        <StepList
          steps={[
            "Unzip DisciplineOS-Setup-win-x64.zip.",
            "Open the extracted folder and double-click DisciplineOS.exe.",
            "Sign in once — your routines and habits stay in sync across every device.",
            "Pin DisciplineOS to your taskbar for one-click discipline.",
          ]}
        />
      </div>
    </div>
  );
}