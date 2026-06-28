import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, AlertCircle, Trophy } from "lucide-react";
import { todayISO } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Coach — DisciplineOS" }] }),
  component: Coach,
});

function Coach() {
  const { data: stats } = useQuery({
    queryKey: ["coach-stats"],
    queryFn: async () => {
      const startD = new Date(); startD.setDate(startD.getDate() - 7);
      const start = startD.toISOString().slice(0, 10);
      const { data: tasks } = await supabase.from("tasks").select("status, category, scheduled_date").gte("scheduled_date", start);
      const { data: focus } = await supabase.from("focus_sessions").select("duration_minutes").gte("session_date", start);
      const { data: habits } = await supabase.from("habits").select("name, current_streak").eq("archived", false);
      return { tasks: tasks ?? [], focus: focus ?? [], habits: habits ?? [] };
    },
  });

  const insights = buildInsights(stats);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald/15 grid place-items-center"><Sparkles className="size-5 text-emerald" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold">AI Coach</h1>
            <p className="text-sm text-muted-foreground">Insights from your last 7 days.</p>
          </div>
        </div>
      </header>

      <div className="glass rounded-3xl p-6">
        <h2 className="font-display font-semibold mb-3">Weekly summary</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{insights.summary}</p>
      </div>

      <div className="space-y-3">
        {insights.cards.map((c, i) => (
          <div key={i} className="glass-soft rounded-2xl p-4 flex gap-3">
            <div className={`size-9 shrink-0 rounded-xl grid place-items-center ${c.tone === "good" ? "bg-emerald/15 text-emerald" : c.tone === "warn" ? "bg-orange/15 text-orange" : "bg-purple/15 text-purple"}`}>
              <c.icon className="size-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.body}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground">Coach insights update as you log tasks, habits, and focus sessions. Today: {todayISO()}</p>
    </div>
  );
}

function buildInsights(stats?: { tasks: { status: string; category: string }[]; focus: { duration_minutes: number }[]; habits: { name: string; current_streak: number }[] }) {
  if (!stats) return { summary: "Loading…", cards: [] as { tone: "good"|"warn"|"info"; icon: typeof TrendingUp; title: string; body: string }[] };
  const total = stats.tasks.length;
  const done = stats.tasks.filter((t) => t.status === "completed").length;
  const missed = stats.tasks.filter((t) => t.status === "missed" || t.status === "late").length;
  const focusH = Math.round(stats.focus.reduce((s, r) => s + r.duration_minutes, 0) / 60 * 10) / 10;
  const rate = total ? Math.round((done / total) * 100) : 0;
  const topHabit = [...stats.habits].sort((a, b) => b.current_streak - a.current_streak)[0];

  const summary = total === 0
    ? "Add a few tasks and habits this week so I can start giving you real insights."
    : `Over the last 7 days you completed ${done} of ${total} tasks (${rate}%) and logged ${focusH}h of focus.${topHabit ? ` Strongest habit: ${topHabit.name} (${topHabit.current_streak}-day streak).` : ""}`;

  const cards: { tone: "good"|"warn"|"info"; icon: typeof TrendingUp; title: string; body: string }[] = [];
  if (rate >= 75) cards.push({ tone: "good", icon: Trophy, title: "You're winning the week", body: "Completion above 75%. Keep the momentum — consider raising your goals." });
  else if (rate >= 50) cards.push({ tone: "info", icon: TrendingUp, title: "Solid progress", body: "You're past halfway. Front-load tomorrow's first 90 minutes for max impact." });
  else if (total > 0) cards.push({ tone: "warn", icon: AlertCircle, title: "Discipline gap", body: "Completion under 50%. Try planning fewer, sharper tasks per day." });

  if (missed >= 3) cards.push({ tone: "warn", icon: AlertCircle, title: "Missed tasks piling up", body: `${missed} tasks missed or late. Move them to a specific time block instead of leaving them open.` });
  if (focusH < 5 && total > 0) cards.push({ tone: "info", icon: TrendingUp, title: "Add deep work blocks", body: "Less than 5h of focus this week. Schedule two 90-min deep work blocks next week." });
  if (topHabit && topHabit.current_streak >= 7) cards.push({ tone: "good", icon: Trophy, title: `${topHabit.current_streak} days of ${topHabit.name}`, body: "Stacking another small habit on top of this routine is the cheapest growth available right now." });

  return { summary, cards };
}