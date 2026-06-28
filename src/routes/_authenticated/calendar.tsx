import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, isoDate } from "@/lib/week";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — DisciplineOS" }] }),
  component: CalendarView,
});

function CalendarView() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(isoDate(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const { data: tasks = [] } = useQuery({
    queryKey: ["cal-tasks", isoDate(monthStart)],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id, title, scheduled_date, start_time, end_time, status, category")
        .gte("scheduled_date", isoDate(monthStart)).lte("scheduled_date", isoDate(monthEnd));
      return data ?? [];
    },
  });

  const dayCount = monthEnd.getDate();
  const firstDayOffset = monthStart.getDay();
  const cells: ({ date: string; day: number; tasks: typeof tasks } | null)[] = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push(null);
  for (let d = 1; d <= dayCount; d++) {
    const date = isoDate(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    cells.push({ date, day: d, tasks: tasks.filter((t) => t.scheduled_date === date) });
  }

  const today = isoDate(new Date());
  const selectedTasks = tasks.filter((t) => t.scheduled_date === selected).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="glass-soft size-9 rounded-xl grid place-items-center"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="glass-soft size-9 rounded-xl grid place-items-center"><ChevronRight className="size-4" /></button>
        </div>
      </header>

      <div className="glass rounded-3xl p-4">
        <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground text-center mb-1">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => c == null ? <div key={i} /> : (
            <button key={i} onClick={() => setSelected(c.date)}
              className={`aspect-square rounded-xl p-1.5 flex flex-col items-start text-[11px] transition-all
                ${selected === c.date ? "bg-emerald text-emerald-foreground" : c.date === today ? "ring-1 ring-emerald" : "hover:bg-accent/10"}`}>
              <span className="font-semibold">{c.day}</span>
              {c.tasks.length > 0 && (
                <div className="mt-auto flex gap-0.5">
                  {c.tasks.slice(0, 3).map((t) => (
                    <span key={t.id} className={`size-1.5 rounded-full ${selected === c.date ? "bg-emerald-foreground/70" : t.status === "completed" ? "bg-emerald" : "bg-muted-foreground/50"}`} />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-display font-semibold text-sm">
          {new Date(selected).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        {selectedTasks.length === 0 ? (
          <Link to="/schedule" className="glass-soft rounded-2xl p-6 grid place-items-center text-sm text-muted-foreground hover:text-emerald">No tasks — plan this day</Link>
        ) : (
          selectedTasks.map((t) => (
            <div key={t.id} className="glass-soft rounded-2xl p-3 flex items-center gap-3">
              <div className={`size-2.5 rounded-full ${t.status === "completed" ? "bg-emerald" : t.status === "missed" ? "bg-destructive" : t.status === "late" ? "bg-orange" : "bg-muted-foreground/40"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{t.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t.start_time ? `${formatTime(t.start_time)}${t.end_time ? `–${formatTime(t.end_time)}` : ""} · ` : ""}{t.category.replace("_", " ")}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}