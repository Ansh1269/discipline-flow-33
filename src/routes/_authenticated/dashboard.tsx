import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, formatTime, greeting } from "@/lib/date";
import { getDailyQuote } from "@/lib/quotes";
import { ProgressRing } from "@/components/ProgressRing";
import { StatusDot } from "@/components/StatusDot";
import { Flame, Target, Brain, ListChecks, Quote, ChevronRight, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Today — DisciplineOS" }, { name: "description", content: "Your daily discipline dashboard." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const date = todayISO();
  const quote = getDailyQuote(now);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", date],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("scheduled_date", date).order("start_time", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: habits = [] } = useQuery({
    queryKey: ["habits-with-logs", date],
    queryFn: async () => {
      const { data: h } = await supabase.from("habits").select("*").eq("archived", false);
      const { data: logs } = await supabase.from("habit_logs").select("*").eq("log_date", date);
      return (h ?? []).map((hh) => ({ ...hh, doneToday: logs?.some((l) => l.habit_id === hh.id) ?? false }));
    },
  });

  const { data: focus = 0 } = useQuery({
    queryKey: ["focus-today", date],
    queryFn: async () => {
      const { data } = await supabase.from("focus_sessions").select("duration_minutes").eq("session_date", date);
      return (data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
    },
  });

  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const remaining = tasks.filter((t) => t.status === "pending" || t.status === "late").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const habitDone = habits.filter((h) => h.doneToday).length;
  const habitTotal = habits.length;

  // Composite scores
  const disciplineScore = Math.round(
    (progress * 0.6 + (habitTotal ? (habitDone / habitTotal) * 100 : 0) * 0.4) / 10
  );
  const productivityScore = Math.round((progress * 0.5 + Math.min(100, (focus / 240) * 100) * 0.5) / 10);

  const focusH = Math.floor(focus / 60);
  const focusM = focus % 60;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-display font-bold">
          {greeting()}, <span className="text-gradient-emerald">{profile?.display_name?.split(" ")[0] || "friend"}</span>
        </h1>
        <p className="text-muted-foreground mt-1">Stay disciplined. Make today count.</p>
      </header>

      {/* Big progress card */}
      <div className="glass rounded-3xl p-6 flex items-center gap-6">
        <ProgressRing value={progress} size={130} stroke={12}>
          <div className="text-center">
            <div className="text-3xl font-display font-bold">{progress}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">today</div>
          </div>
        </ProgressRing>
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Tasks</div>
            <div className="font-display text-lg font-semibold">{completed}/{total} done</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className="font-display text-lg font-semibold">{remaining}</div>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Trophy} color="text-emerald" label="Discipline" value={`${disciplineScore}.0`} suffix="/10" />
        <Kpi icon={Brain} color="text-purple" label="Productivity" value={`${productivityScore}.0`} suffix="/10" />
        <Kpi icon={Flame} color="text-orange" label="Streak" value={`${profile?.current_streak ?? 0}`} suffix=" days" />
        <Kpi icon={Target} color="text-emerald" label="Focus" value={`${focusH}h ${focusM}m`} />
      </div>

      {/* Habits row */}
      <Section title="Today's habits" href="/habits">
        {habits.length === 0 ? (
          <EmptyHint to="/habits" label="Create your first habit" />
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {habits.slice(0, 4).map((h) => (
              <div key={h.id} className="glass-soft rounded-2xl p-3 text-center">
                <ProgressRing value={h.doneToday ? 100 : 0} size={56} stroke={5} color={`var(--color-${h.color || "emerald"})`}>
                  <Flame className={`size-4 ${h.doneToday ? "text-emerald" : "text-muted-foreground"}`} />
                </ProgressRing>
                <div className="text-[11px] mt-2 font-medium truncate">{h.name}</div>
                <div className="text-[10px] text-muted-foreground">🔥 {h.current_streak}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Timeline */}
      <Section title="Today's schedule" href="/schedule">
        {tasks.length === 0 ? (
          <EmptyHint to="/schedule" label="Plan your day" />
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 6).map((t) => (
              <div key={t.id} className="glass-soft rounded-2xl p-3 flex items-center gap-3">
                <StatusDot status={t.status as never} />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate text-sm ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTime(t.start_time)}{t.end_time ? ` – ${formatTime(t.end_time)}` : ""} · {t.category.replace("_", " ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Quote */}
      <div className="glass rounded-3xl p-6 flex gap-4">
        <Quote className="size-6 text-emerald shrink-0 mt-1" />
        <div>
          <p className="font-display text-base leading-snug">"{quote.q}"</p>
          <p className="text-xs text-muted-foreground mt-2">— {quote.a}</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, suffix }: { icon: typeof Flame; color: string; label: string; value: string; suffix?: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <Icon className={`size-4 ${color}`} />
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-0.5">{value}<span className="text-xs text-muted-foreground font-normal">{suffix}</span></div>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-base">{title}</h2>
        <Link to={href} className="text-xs text-emerald flex items-center gap-0.5 hover:gap-1.5 transition-all">View all <ChevronRight className="size-3" /></Link>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="glass-soft rounded-2xl p-6 grid place-items-center text-sm text-muted-foreground hover:text-emerald transition">
      <ListChecks className="size-6 mb-2" />
      {label}
    </Link>
  );
}