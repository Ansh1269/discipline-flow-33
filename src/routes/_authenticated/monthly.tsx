import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { startOfMonth, endOfMonth, isoDate } from "@/lib/week";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/monthly")({
  head: () => ({ meta: [{ title: "Monthly — DisciplineOS" }] }),
  component: Monthly,
});

function Monthly() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const startISO = isoDate(monthStart);
  const endISO = isoDate(monthEnd);

  const { data = { byDay: {}, totals: { done: 0, total: 0, focus: 0, habitDays: 0 } } } = useQuery({
    queryKey: ["monthly", startISO],
    queryFn: async () => {
      const [tasksRes, focusRes, habitsRes] = await Promise.all([
        supabase.from("tasks").select("scheduled_date, status").gte("scheduled_date", startISO).lte("scheduled_date", endISO),
        supabase.from("focus_sessions").select("session_date, duration_minutes").gte("session_date", startISO).lte("session_date", endISO),
        supabase.from("habit_logs").select("log_date").gte("log_date", startISO).lte("log_date", endISO),
      ]);
      const tasks = tasksRes.data ?? [];
      const focus = focusRes.data ?? [];
      const habits = habitsRes.data ?? [];
      const byDay: Record<string, { done: number; total: number; focus: number; habits: number }> = {};
      tasks.forEach((t) => {
        byDay[t.scheduled_date] ??= { done: 0, total: 0, focus: 0, habits: 0 };
        byDay[t.scheduled_date].total += 1;
        if (t.status === "completed") byDay[t.scheduled_date].done += 1;
      });
      focus.forEach((f) => {
        byDay[f.session_date] ??= { done: 0, total: 0, focus: 0, habits: 0 };
        byDay[f.session_date].focus += f.duration_minutes;
      });
      habits.forEach((h) => {
        byDay[h.log_date] ??= { done: 0, total: 0, focus: 0, habits: 0 };
        byDay[h.log_date].habits += 1;
      });
      const totals = {
        done: tasks.filter((t) => t.status === "completed").length,
        total: tasks.length,
        focus: Math.round(focus.reduce((s, r) => s + r.duration_minutes, 0) / 60 * 10) / 10,
        habitDays: new Set(habits.map((h) => h.log_date)).size,
      };
      return { byDay, totals };
    },
  });

  // Calendar grid
  const firstDay = monthStart.getDay(); // 0 sun
  const daysInMonth = monthEnd.getDate();
  const cells: ({ date: string; day: number; intensity: number; isToday: boolean } | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  const today = isoDate(new Date());
  for (let d = 1; d <= daysInMonth; d++) {
    const date = isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    const stat = data.byDay[date];
    const intensity = stat?.total ? stat.done / stat.total : (stat?.habits ? Math.min(1, stat.habits / 5) : 0);
    cells.push({ date, day: d, intensity, isToday: date === today });
  }

  const completion = data.totals.total ? Math.round((data.totals.done / data.totals.total) * 100) : 0;
  const missedDays = Object.values(data.byDay).filter((d) => d.total > 0 && d.done === 0).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Monthly</h1>
          <p className="text-sm text-muted-foreground">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="glass-soft size-9 rounded-xl grid place-items-center"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="glass-soft size-9 rounded-xl grid place-items-center"><ChevronRight className="size-4" /></button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Completion" value={`${completion}%`} />
        <Stat label="Tasks done" value={`${data.totals.done}`} />
        <Stat label="Focus" value={`${data.totals.focus}h`} />
        <Stat label="Habit days" value={`${data.totals.habitDays}`} />
      </div>

      <div className="glass rounded-3xl p-5">
        <h2 className="font-display font-semibold text-sm mb-3">Heatmap</h2>
        <div className="grid grid-cols-7 gap-1.5 text-[10px] text-muted-foreground text-center mb-1">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c, i) => c == null ? (
            <div key={i} />
          ) : (
            <div key={i} className={`aspect-square rounded-lg flex items-end justify-end p-1 text-[10px] font-medium ${c.isToday ? "ring-2 ring-emerald" : ""}`}
              style={{ background: c.intensity > 0 ? `oklch(0.72 0.16 158 / ${0.15 + c.intensity * 0.6})` : "oklch(0.5 0.02 260 / 0.08)" }}>
              <span className={c.intensity > 0.4 ? "text-foreground" : "text-muted-foreground"}>{c.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Missed days</div>
          <div className="font-display text-2xl font-bold mt-1">{missedDays}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg productivity</div>
          <div className="font-display text-2xl font-bold mt-1">{Math.round((completion * 0.6 + Math.min(100, (data.totals.focus / 40) * 100) * 0.4) / 10)}/10</div>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h2 className="font-display font-semibold text-sm mb-2 flex items-center gap-2"><Trophy className="size-4 text-emerald" /> Monthly summary</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You completed <strong className="text-foreground">{data.totals.done}/{data.totals.total}</strong> tasks ({completion}%),
          logged <strong className="text-foreground">{data.totals.focus}h</strong> of focus and stayed consistent on
          <strong className="text-foreground"> {data.totals.habitDays}</strong> habit days this month.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}