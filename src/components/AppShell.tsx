import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Flame, BarChart3, Target, Sparkles, LogOut, Settings as SettingsIcon, Sun, Moon, Trophy, Bell, CalendarRange, CalendarCheck, CalendarSearch, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useReminderScheduler } from "@/lib/reminder-scheduler";

const NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/tracker", label: "Tracker", icon: Activity },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/coach", label: "Coach", icon: Sparkles },
] as const;

const SIDE_EXTRA = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: CalendarSearch },
  { to: "/weekly", label: "Weekly", icon: CalendarRange },
  { to: "/monthly", label: "Monthly", icon: CalendarCheck },
  { to: "/yearly", label: "Yearly", icon: CalendarDays },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  useReminderScheduler();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-svh pb-24 md:pb-8 md:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col p-5 border-r border-border bg-sidebar overflow-y-auto">
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
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
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
                <Icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-4">
          <button onClick={toggle} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-accent/10 transition-all">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="max-w-2xl mx-auto px-4 pt-6 md:pt-10 md:px-8">
        <div className="md:hidden flex justify-end mb-2">
          <button onClick={toggle} className="glass rounded-full size-9 grid place-items-center text-muted-foreground" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        <div className="glass rounded-2xl flex items-center justify-around px-2 py-2">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${active ? "text-emerald" : "text-muted-foreground"}`}>
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