import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { todayISO, formatTime } from "@/lib/date";
import { ProgressRing } from "@/components/ProgressRing";
import { fetchDayTasks, dayTasksKey, type DayTask } from "@/lib/dailyTasks";

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({ meta: [{ title: "Tracker — DisciplineOS" }] }),
  component: Tracker,
});

type Task = DayTask;

function classify(t: Task, now: Date): "completed" | "late" | "missed" | "current" | "upcoming" | "pending" {
  if (t.status === "completed") return "completed";
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string | null) => s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null;
  const start = toMin(t.start_time);
  const end = toMin(t.end_time);
  if (end !== null && nowMin > end) return "missed";
  if (start !== null && nowMin > start && (end === null || nowMin <= end)) return "late";
  if (start !== null && nowMin >= start - 15 && nowMin < start) return "current";
  return start === null ? "pending" : "upcoming";
}

const COLORS: Record<string, string> = {
  completed: "bg-emerald text-emerald",
  late: "bg-orange text-orange",
  missed: "bg-destructive text-destructive",
  current: "bg-purple text-purple",
  upcoming: "bg-muted-foreground/40 text-muted-foreground",
  pending: "bg-muted-foreground/40 text-muted-foreground",
};

function Tracker() {
  const [date] = useState(todayISO());
  const now = new Date();
  const { data: tasks = [] } = useQuery({
    queryKey: dayTasksKey(date),
    queryFn: () => fetchDayTasks(date),
    refetchInterval: 60_000,
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const missed = tasks.filter((t) => classify(t, now) === "missed").length;
  const late = tasks.filter((t) => classify(t, now) === "late").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Today's Tracker</h1>
        <p className="text-sm text-muted-foreground">Your day in chronological order.</p>
      </header>

      <div className="glass rounded-3xl p-5 flex items-center gap-5">
        <ProgressRing value={pct} size={88} />
        <div className="flex-1 grid grid-cols-3 gap-2 text-center">
          <Stat label="Done" value={completed} accent="text-emerald" />
          <Stat label="Late" value={late} accent="text-orange" />
          <Stat label="Missed" value={missed} accent="text-destructive" />
        </div>
      </div>

      <div className="relative pl-6">
        <div className="absolute left-[10px] top-1 bottom-1 w-px bg-border" />
        {tasks.length === 0 && <p className="text-center text-muted-foreground py-12">Nothing scheduled.</p>}
        {tasks.map((t) => {
          const c = classify(t, now);
          const [bg, text] = COLORS[c].split(" ");
          return (
            <div key={t.id} className="relative pb-4">
              <span className={`absolute -left-[18px] top-3 size-3 rounded-full ${bg} ring-4 ring-background`} />
              <div className="glass-soft rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={`font-medium truncate ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    {t.start_time && <span>{formatTime(t.start_time)}{t.end_time ? `–${formatTime(t.end_time)}` : ""}</span>}
                    <span className="px-1.5 py-0.5 rounded bg-accent/10">{t.category.replace("_", " ")}</span>
                  </div>
                </div>
                <span className={`text-[10px] uppercase font-semibold ${text}`}>{c}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <div className={`font-display text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}