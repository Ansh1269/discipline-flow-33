import { supabase } from "@/integrations/supabase/client";
import { occursOn, addDaysISO } from "@/lib/recurrence";

export type DayTask = {
  key: string;
  kind: "one" | "recur";
  id: string;
  recurring_id?: string;
  log_id?: string;
  title: string;
  status: string; // pending | completed | late | missed | skipped
  start_time: string | null;
  end_time: string | null;
  category: string;
  priority: string;
  notes: string | null;
  position: number;
  repeat_type?: string;
  repeat_days?: number[] | null;
};

export type DayCounts = { done: number; total: number };

export function dayTasksKey(date: string) {
  return ["day-tasks", date] as const;
}

export function rangeDayTasksKey(startDate: string, days: number) {
  return ["day-tasks-range", startDate, days] as const;
}

/** Fetch combined (one-time + recurring) tasks for a single date. */
export async function fetchDayTasks(date: string): Promise<DayTask[]> {
  const [oneRes, recRes, logRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("scheduled_date", date),
    supabase.from("recurring_tasks" as never).select("*"),
    supabase.from("recurring_task_logs" as never).select("*").eq("occurrence_date", date),
  ]);

  const oneTime = (oneRes.data ?? []) as Array<{
    id: string; title: string; status: string; start_time: string | null;
    end_time: string | null; category: string; priority: string; notes: string | null;
    position: number | null;
  }>;
  const recurring = (recRes.data ?? []) as unknown as Array<{
    id: string; title: string; notes: string | null; category: string; priority: string;
    start_time: string | null; end_time: string | null;
    repeat_type: string; repeat_days: number[] | null;
    starts_on: string; ends_on: string | null; position: number;
  }>;
  const logs = (logRes.data ?? []) as unknown as Array<{
    id: string; recurring_task_id: string; status: string; skipped: boolean;
    override_title: string | null; override_start_time: string | null;
    override_end_time: string | null; override_notes: string | null;
  }>;

  const recurItems: DayTask[] = recurring
    .filter((rt) => occursOn(rt, date))
    .map((rt) => {
      const log = logs.find((l) => l.recurring_task_id === rt.id);
      if (log?.skipped) return null;
      return {
        key: `r:${rt.id}`,
        kind: "recur" as const,
        id: rt.id,
        recurring_id: rt.id,
        log_id: log?.id,
        title: log?.override_title ?? rt.title,
        status: log?.status ?? "pending",
        start_time: log?.override_start_time ?? rt.start_time,
        end_time: log?.override_end_time ?? rt.end_time,
        category: rt.category,
        priority: rt.priority,
        notes: log?.override_notes ?? rt.notes,
        position: rt.position ?? 0,
        repeat_type: rt.repeat_type,
        repeat_days: rt.repeat_days,
      } satisfies DayTask;
    })
    .filter(Boolean) as DayTask[];

  const oneItems: DayTask[] = oneTime.map((t) => ({
    key: `o:${t.id}`,
    kind: "one",
    id: t.id,
    title: t.title,
    status: t.status,
    start_time: t.start_time,
    end_time: t.end_time,
    category: t.category,
    priority: t.priority,
    notes: t.notes,
    position: t.position ?? 1000,
  }));

  return [...recurItems, ...oneItems].sort((a, b) => {
    const at = a.start_time ?? "99:99";
    const bt = b.start_time ?? "99:99";
    if (at !== bt) return at.localeCompare(bt);
    return a.position - b.position;
  });
}

/** Fetch per-date completion counts over a window starting at startDate, inclusive, for `days` days. */
export async function fetchRangeCompletion(
  startDate: string,
  days: number,
): Promise<Record<string, DayCounts>> {
  const endDate = addDaysISO(startDate, days - 1);

  const [oneRes, recRes, logRes] = await Promise.all([
    supabase.from("tasks").select("scheduled_date, status").gte("scheduled_date", startDate).lte("scheduled_date", endDate),
    supabase.from("recurring_tasks" as never).select("*"),
    supabase.from("recurring_task_logs" as never).select("recurring_task_id, occurrence_date, status, skipped")
      .gte("occurrence_date", startDate).lte("occurrence_date", endDate),
  ]);

  const oneTime = (oneRes.data ?? []) as Array<{ scheduled_date: string; status: string }>;
  const recurring = (recRes.data ?? []) as unknown as Array<{
    id: string; repeat_type: string; repeat_days: number[] | null;
    starts_on: string; ends_on: string | null;
  }>;
  const logs = (logRes.data ?? []) as unknown as Array<{
    recurring_task_id: string; occurrence_date: string; status: string; skipped: boolean;
  }>;

  const out: Record<string, DayCounts> = {};
  for (let i = 0; i < days; i++) {
    const d = addDaysISO(startDate, i);
    out[d] = { done: 0, total: 0 };
  }

  for (const t of oneTime) {
    if (!out[t.scheduled_date]) continue;
    out[t.scheduled_date].total += 1;
    if (t.status === "completed") out[t.scheduled_date].done += 1;
  }

  for (const d of Object.keys(out)) {
    for (const rt of recurring) {
      if (!occursOn(rt, d)) continue;
      const log = logs.find((l) => l.recurring_task_id === rt.id && l.occurrence_date === d);
      if (log?.skipped) continue;
      out[d].total += 1;
      if (log?.status === "completed") out[d].done += 1;
    }
  }

  return out;
}

/** Invalidate every query key derived from daily tasks. Use after any task mutation. */
export function invalidationKeys(date: string) {
  return [
    ["day-tasks", date],
    ["day-tasks-range"],
    ["tasks", date],
    ["tasks-range"],
    ["recurring-tasks"],
    ["recurring-logs", date],
  ] as const;
}