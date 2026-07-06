import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Flame, BarChart3, Target, Sparkles, LogOut, Settings as SettingsIcon, Sun, Moon, Trophy, Bell, CalendarRange, CalendarCheck, CalendarSearch, Activity, Download, User as UserIcon, BookOpen, StickyNote, Menu, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useReminderScheduler } from "@/lib/reminder-scheduler";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/tracker", label: "Tracker", icon: Activity },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/coach", label: "Coach", icon: Sparkles },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

const SIDE_EXTRA = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/calendar", label: "Calendar", icon: CalendarSearch },
  { to: "/weekly", label: "Weekly", icon: CalendarRange },
  { to: "/monthly", label: "Monthly", icon: CalendarCheck },
  { to: "/yearly", label: "Yearly", icon: CalendarDays },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/security", label: "Security", icon: Shield },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/download", label: "Get the app", icon: Download },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  useReminderScheduler();
  const [moreOpen, setMoreOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-8 md:pl-64">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-emerald focus:text-emerald-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside aria-label="Primary" className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col p-5 border-r border-border bg-sidebar overflow-y-auto">
        <Link to="/dashboard" className="flex items-center gap-2 mb-8">
          <div className="size-9 rounded-xl bg-emerald/15 grid place-items-center">
            <Sparkles className="size-5 text-emerald" />
          </div>
          <span className="font-display font-bold text-lg">DisciplineOS</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50 ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
                <Icon className="size-4" /> {n.label}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-border" />
          {SIDE_EXTRA.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50 ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
                <Icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-4">
          <button onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-accent/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="max-w-2xl mx-auto px-4 pt-6 md:pt-10 md:px-8 focus:outline-none">
        <div className="md:hidden flex justify-between items-center mb-2 gap-2">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="glass rounded-full min-h-11 min-w-11 grid place-items-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50" aria-label="Open menu">
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald" /> DisciplineOS
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-4">
                {[...NAV, ...SIDE_EXTRA].map((n) => {
                  const Icon = n.icon;
                  const active = location.pathname.startsWith(n.to);
                  return (
                    <Link key={n.to} to={n.to} onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
                      <Icon className="size-4" /> {n.label}
                    </Link>
                  );
                })}
                <div className="my-2 h-px bg-border" />
                <button onClick={() => { setMoreOpen(false); void signOut(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-accent/10 transition-all">
                  <LogOut className="size-4" /> Sign out
                </button>
              </nav>
            </SheetContent>
          </Sheet>
          <button onClick={toggle} className="glass rounded-full min-h-11 min-w-11 grid place-items-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        <div className="glass rounded-2xl flex items-center justify-around px-2 py-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                aria-current={active ? "page" : undefined}
                aria-label={n.label}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-h-11 min-w-11 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50 ${active ? "text-emerald" : "text-muted-foreground"}`}>
                <Icon className={`size-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className="text-[10px] font-medium">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}