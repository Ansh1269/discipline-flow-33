import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, formatTime, greeting } from "@/lib/date";
import { getDailyQuote } from "@/lib/quotes";
import { ProgressRing } from "@/components/ProgressRing";
import { StatusDot } from "@/components/StatusDot";
import { Flame, Target, Brain, ListChecks, Quote, ChevronRight, Trophy, TrendingUp, TrendingDown, Sparkles, Zap } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { WeeklyChart, type WeeklyPoint } from "@/components/WeeklyChart";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Today — DisciplineOS" }, { name: "description", content: "Your daily discipline dashboard." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
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

  const tasksQ = useQuery({
    queryKey: ["tasks", date],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("scheduled_date", date).order("start_time", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });
  const tasks = tasksQ.data ?? [];

  const habitsQ = useQuery({
    queryKey: ["habits-with-logs", date],
    queryFn: async () => {
      const { data: h } = await supabase.from("habits").select("*").eq("archived", false);
      const { data: logs } = await supabase.from("habit_logs").select("*").eq("log_date", date);
      return (h ?? []).map((hh) => ({ ...hh, doneToday: logs?.some((l) => l.habit_id === hh.id) ?? false }));
    },
  });
  const habits = habitsQ.data ?? [];

  const focusQ = useQuery({
    queryKey: ["focus-today", date],
    queryFn: async () => {
      const { data } = await supabase.from("focus_sessions").select("duration_minutes").eq("session_date", date);
      return (data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
    },
  });
  const focus = focusQ.data ?? 0;

  // Last 84 days window for weekly chart + heatmap
  const windowStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 83);
    return d.toISOString().slice(0, 10);
  })();

  const { data: rangeTasks = [] } = useQuery({
    queryKey: ["tasks-range", windowStart],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("scheduled_date, status").gte("scheduled_date", windowStart);
      return data ?? [];
    },
  });

  const { data: rangeHabitLogs = [] } = useQuery({
    queryKey: ["habit-logs-range", windowStart],
    queryFn: async () => {
      const { data } = await supabase.from("habit_logs").select("log_date").gte("log_date", windowStart);
      return data ?? [];
    },
  });

  const { data: rangeFocus = [] } = useQuery({
    queryKey: ["focus-range", windowStart],
    queryFn: async () => {
      const { data } = await supabase.from("focus_sessions").select("session_date, duration_minutes").gte("session_date", windowStart);
      return data ?? [];
    },
  });

  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const remaining = tasks.filter((t) => t.status === "pending" || t.status === "late").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const habitDone = habits.filter((h) => h.doneToday).length;
  const habitTotal = habits.length;

  // Composite scores
  const disciplineScore =
    Math.round((progress * 0.6 + (habitTotal ? (habitDone / habitTotal) * 100 : 0) * 0.4) / 10 * 10) / 10;
  const productivityScore =
    Math.round((progress * 0.5 + Math.min(100, (focus / 240) * 100) * 0.5) / 10 * 10) / 10;

  const focusH = Math.floor(focus / 60);
  const focusM = focus % 60;

  // Weekly chart — last 7 days completion %
  const weekly: WeeklyPoint[] = (() => {
    const out: WeeklyPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayTasks = rangeTasks.filter((t) => t.scheduled_date === key);
      const done = dayTasks.filter((t) => t.status === "completed").length;
      const tot = dayTasks.length;
      out.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
        date: key,
        pct: tot ? Math.round((done / tot) * 100) : 0,
        done,
        total: tot,
      });
    }
    return out;
  })();

  // Heatmap aggregation: count any activity per day
  const heatData: Record<string, number> = {};
  rangeTasks.forEach((t) => { if (t.status === "completed") heatData[t.scheduled_date] = (heatData[t.scheduled_date] ?? 0) + 1; });
  rangeHabitLogs.forEach((l) => { heatData[l.log_date] = (heatData[l.log_date] ?? 0) + 1; });
  rangeFocus.forEach((f) => { if ((f.duration_minutes ?? 0) > 0) heatData[f.session_date] = (heatData[f.session_date] ?? 0) + 1; });

  // Insights: 7-day vs prior 7-day completion delta
  const last7 = weekly.reduce((s, w) => s + w.pct, 0) / 7;
  const prior7: number = (() => {
    let sum = 0;
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const day = rangeTasks.filter((t) => t.scheduled_date === key);
      const pct = day.length ? (day.filter((t) => t.status === "completed").length / day.length) * 100 : 0;
      sum += pct;
    }
    return sum / 7;
  })();
  const delta = Math.round(last7 - prior7);
  const activeDays = Object.keys(heatData).filter((k) => k <= date).length;
  const bestDay = weekly.reduce((b, w) => (w.pct > b.pct ? w : b), weekly[0] ?? { label: "—", pct: 0 } as WeeklyPoint);

  const initialLoading = tasksQ.isLoading && habitsQ.isLoading && focusQ.isLoading;
  if (initialLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-display font-bold tracking-tight">
          {greeting()}, <span className="text-gradient-emerald">{profile?.display_name?.split(" ")[0] || "friend"}</span>
        </h1>
        <p className="text-muted-foreground mt-1">Stay disciplined. Make today count.</p>
      </header>

      {/* Big progress card */}
      <div className="glass rounded-3xl p-6 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <ProgressRing value={progress} size={130} stroke={12}>
          <div className="text-center">
            <div className="text-3xl font-display font-bold">
              <AnimatedNumber value={progress} />%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">today</div>
          </div>
        </ProgressRing>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Tasks</div>
            <div className="font-display text-lg font-semibold tabular-nums">
              <AnimatedNumber value={completed} />/{total} done
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className="font-display text-lg font-semibold tabular-nums"><AnimatedNumber value={remaining} /></div>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {delta >= 0 ? <TrendingUp className="size-3.5 text-emerald" /> : <TrendingDown className="size-3.5 text-orange" />}
            <span className={delta >= 0 ? "text-emerald" : "text-orange"}>{delta >= 0 ? "+" : ""}{delta}%</span>
            <span className="text-muted-foreground">vs last week</span>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Trophy} color="text-emerald" label="Discipline" animated={disciplineScore} decimals={1} suffix="/10" />
        <Kpi icon={Brain} color="text-purple" label="Productivity" animated={productivityScore} decimals={1} suffix="/10" />
        <Kpi icon={Flame} color="text-orange" label="Streak" animated={profile?.current_streak ?? 0} suffix=" days" />
        <Kpi icon={Target} color="text-emerald" label="Focus" value={`${focusH}h ${focusM}m`} />
      </div>

      {/* Weekly progress */}
      <section className="glass rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-base">Weekly progress</h2>
            <p className="text-xs text-muted-foreground">Task completion · last 7 days</p>
          </div>
          <Link to="/weekly" className="text-xs text-emerald flex items-center gap-0.5 hover:gap-1.5 transition-all" aria-label="Open weekly dashboard">View <ChevronRight className="size-3" /></Link>
        </div>
        {weekly.every((w) => w.total === 0) ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Schedule a few tasks this week to see your trend.</div>
        ) : (
          <WeeklyChart data={weekly} />
        )}
      </section>

      {/* Activity heatmap */}
      <section className="glass rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-base">Activity</h2>
            <p className="text-xs text-muted-foreground">Last 12 weeks · tasks, habits & focus</p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{activeDays} active days</span>
        </div>
        <div className="overflow-x-auto -mx-1 px-1">
          <ActivityHeatmap data={heatData} weeks={12} />
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="size-2.5 rounded-[2px]" style={{ background: ["oklch(0.6 0.02 260 / 0.12)", "oklch(0.72 0.16 158 / 0.25)", "oklch(0.72 0.16 158 / 0.45)", "oklch(0.72 0.16 158 / 0.7)", "oklch(0.72 0.16 158 / 0.95)"][i] }} />
          ))}
          <span>More</span>
        </div>
      </section>

      {/* Productivity insights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Insight icon={Sparkles} tone="emerald" title="Best day this week" body={bestDay && bestDay.total > 0 ? `${bestDay.label} · ${bestDay.pct}% completion` : "No data yet — start a streak today."} />
        <Insight icon={Zap} tone="purple" title="Focus today" body={focus > 0 ? `${focusH}h ${focusM}m logged · keep the deep work going.` : "Start a focus session to build your score."} />
        <Insight icon={delta >= 0 ? TrendingUp : TrendingDown} tone={delta >= 0 ? "emerald" : "orange"} title="Momentum" body={`${delta >= 0 ? "Up" : "Down"} ${Math.abs(delta)}% vs the previous 7 days.`} />
      </section>

      {/* Habits row */}
      <Section title="Today's habits" href="/habits">
        {habitsQ.isLoading ? (
          <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-soft rounded-2xl h-[100px] animate-pulse" />)}</div>
        ) : habits.length === 0 ? (
          <EmptyHint to="/habits" label="Create your first habit" />
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {habits.slice(0, 4).map((h) => (
              <Link to="/habits" key={h.id} className="glass-soft rounded-2xl p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <ProgressRing value={h.doneToday ? 100 : 0} size={56} stroke={5} color={`var(--color-${h.color || "emerald"})`}>
                  <Flame className={`size-4 ${h.doneToday ? "text-emerald" : "text-muted-foreground"}`} />
                </ProgressRing>
                <div className="text-[11px] mt-2 font-medium truncate">{h.name}</div>
                <div className="text-[10px] text-muted-foreground">🔥 {h.current_streak}</div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Timeline */}
      <Section title="Today's schedule" href="/schedule">
        {tasksQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-soft rounded-2xl h-12 animate-pulse" />)}</div>
        ) : tasks.length === 0 ? (
          <EmptyHint to="/schedule" label="Plan your day" />
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 6).map((t) => (
              <Link to="/schedule" key={t.id} className="glass-soft rounded-2xl p-3 flex items-center gap-3 transition-colors hover:bg-accent/10">
                <StatusDot status={t.status as never} />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate text-sm ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTime(t.start_time)}{t.end_time ? ` – ${formatTime(t.end_time)}` : ""} · {t.category.replace("_", " ")}
                  </div>
                </div>
              </Link>
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

function Kpi({ icon: Icon, color, label, value, animated, decimals, suffix }: { icon: typeof Flame; color: string; label: string; value?: string; animated?: number; decimals?: number; suffix?: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <Icon className={`size-4 ${color}`} aria-hidden />
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-0.5 tabular-nums">
        {typeof animated === "number" ? <AnimatedNumber value={animated} decimals={decimals ?? 0} /> : value}
        {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

function Insight({ icon: Icon, tone, title, body }: { icon: typeof Flame; tone: "emerald" | "purple" | "orange"; title: string; body: string }) {
  const toneClass = tone === "emerald" ? "text-emerald bg-emerald/10" : tone === "purple" ? "text-purple bg-purple/10" : "text-orange bg-orange/10";
  return (
    <div className="glass-soft rounded-2xl p-4 flex gap-3 items-start">
      <div className={`size-9 rounded-xl grid place-items-center shrink-0 ${toneClass}`}><Icon className="size-4" aria-hidden /></div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="text-sm font-medium leading-snug mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-base">{title}</h2>
        <Link to={href} className="text-xs text-emerald flex items-center gap-0.5 hover:gap-1.5 transition-all" aria-label={`View all ${title.toLowerCase()}`}>View all <ChevronRight className="size-3" /></Link>
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