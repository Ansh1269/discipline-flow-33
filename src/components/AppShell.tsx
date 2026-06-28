import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Flame, BarChart3, Target, Sparkles, LogOut, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/coach", label: "Coach", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-svh pb-24 md:pb-8 md:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col p-5 border-r border-white/5 bg-[oklch(0.18_0.035_260)]">
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                <Icon className="size-4" /> {n.label}
              </Link>
            );
          })}
          <Link to="/goals" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname.startsWith("/goals") ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
            <Target className="size-4" /> Goals
          </Link>
          <Link to="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname.startsWith("/settings") ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
            <SettingsIcon className="size-4" /> Settings
          </Link>
        </nav>
        <button onClick={signOut} className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-white/5 transition-all">
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>

      <main className="max-w-2xl mx-auto px-4 pt-6 md:pt-10 md:px-8">
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