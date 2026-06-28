import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/date";
import { startOfWeek, isoDate } from "@/lib/week";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Flame, Check, Trash2, Pencil, ChevronRight, Bell } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { HabitForm, DIFFICULTY_STYLES, type HabitFormValues } from "@/components/HabitForm";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Habits — DisciplineOS" }] }),
  component: Habits,
});

function Habits() {
  const qc = useQueryClient();
  const date = todayISO();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const habitsQ = useQuery({
    queryKey: ["habits-with-logs", date],
    queryFn: async () => {
      const weekStart = isoDate(startOfWeek(new Date(), 1));
      const { data: h } = await supabase.from("habits").select("*").eq("archived", false).order("created_at");
      const { data: logs } = await supabase.from("habit_logs").select("habit_id, log_date").gte("log_date", weekStart);
      return (h ?? []).map((hh) => {
        const week = (logs ?? []).filter((l) => l.habit_id === hh.id);
        return {
          ...hh,
          doneToday: week.some((l) => l.log_date === date),
          weekCount: week.length,
        };
      });
    },
  });
  const habits = habitsQ.data ?? [];

  // Last 30 days for consistency
  const { data: monthly = {} } = useQuery<Record<string, number>>({
    queryKey: ["habit-monthly"],
    queryFn: async () => {
      const start = new Date(); start.setDate(start.getDate() - 30);
      const startISO = start.toISOString().slice(0, 10);
      const { data } = await supabase.from("habit_logs").select("habit_id, log_date").gte("log_date", startISO);
      const map: Record<string, number> = {};
      (data ?? []).forEach((l) => { map[l.habit_id] = (map[l.habit_id] ?? 0) + 1; });
      return map;
    },
  });

  const editingHabit = editId ? habits.find((h) => h.id === editId) : null;

  const create = useMutation({
    mutationFn: async (values: HabitFormValues) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("habits").insert({
        user_id: u.user!.id,
        name: values.name,
        icon: values.icon || "",
        color: values.color,
        difficulty: values.difficulty,
        target_per_week: values.target_per_week,
        reminder_time: values.reminder_time || null,
        notes: values.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-with-logs", date] });
      setOpen(false);
      toast.success("Habit created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save habit"),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: HabitFormValues }) => {
      const { error } = await supabase.from("habits").update({
        name: values.name,
        icon: values.icon || "",
        color: values.color,
        difficulty: values.difficulty,
        target_per_week: values.target_per_week,
        reminder_time: values.reminder_time || null,
        notes: values.notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-with-logs", date] });
      setEditId(null);
      toast.success("Habit updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update habit"),
  });

  const toggle = useMutation({
    mutationFn: async (habit: { id: string; doneToday: boolean; current_streak: number; longest_streak: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (habit.doneToday) {
        const { error } = await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("log_date", date);
        if (error) throw error;
        const newStreak = Math.max(0, habit.current_streak - 1);
        await supabase.from("habits").update({ current_streak: newStreak }).eq("id", habit.id);
      } else {
        const { error } = await supabase.from("habit_logs").insert({ user_id: u.user!.id, habit_id: habit.id, log_date: date });
        if (error) throw error;
        const newStreak = habit.current_streak + 1;
        await supabase.from("habits").update({
          current_streak: newStreak,
          longest_streak: Math.max(habit.longest_streak, newStreak),
        }).eq("id", habit.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-with-logs", date] });
      qc.invalidateQueries({ queryKey: ["habit-monthly"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits-with-logs", date] }); toast.success("Habit removed"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove habit"),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Habits</h1>
        <p className="text-sm text-muted-foreground">Small daily wins compound into discipline.</p>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-emerald hover:bg-emerald/90 text-emerald-foreground font-semibold"><Plus className="size-4" /> New habit</Button>
        </DialogTrigger>
        <DialogContent className="glass border-border max-h-[90svh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New habit</DialogTitle></DialogHeader>
          <HabitForm onSubmit={(v) => create.mutate(v)} submitLabel="Create habit" busy={create.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(o) => { if (!o) setEditId(null); }}>
        <DialogContent className="glass border-border max-h-[90svh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Edit habit</DialogTitle></DialogHeader>
          {editingHabit && (
            <HabitForm
              initial={{
                name: editingHabit.name,
                icon: editingHabit.icon || "",
                color: (editingHabit.color as HabitFormValues["color"]) || "emerald",
                difficulty: editingHabit.difficulty,
                target_per_week: editingHabit.target_per_week,
                reminder_time: editingHabit.reminder_time?.slice(0, 5) || "",
                notes: editingHabit.notes || "",
              }}
              onSubmit={(v) => update.mutate({ id: editingHabit.id, values: v })}
              submitLabel="Save changes"
              busy={update.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {habitsQ.isLoading && (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        )}
        {!habitsQ.isLoading && habits.length === 0 && (
          <div className="glass-soft rounded-2xl p-10 text-center space-y-2">
            <Flame className="size-7 text-emerald mx-auto" aria-hidden />
            <p className="font-medium">No habits yet</p>
            <p className="text-sm text-muted-foreground">Start with one small daily action — drink water, walk 10 minutes, read a page.</p>
          </div>
        )}
        {habits.map((h) => {
          const consistency = Math.round(((monthly[h.id] ?? 0) / 30) * 100);
          const weekPct = Math.min(100, Math.round((h.weekCount / h.target_per_week) * 100));
          return (
            <div key={h.id} className="glass-soft rounded-2xl p-4 group transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggle.mutate(h)}
                  className="shrink-0 transition-transform active:scale-90"
                  aria-label={h.doneToday ? `Mark ${h.name} not done` : `Mark ${h.name} done for today`}
                >
                  <ProgressRing value={h.doneToday ? 100 : 0} size={56} stroke={5} color={`var(--color-${h.color})`}>
                    {h.icon ? (
                      <span className="text-base leading-none" aria-hidden>{h.icon}</span>
                    ) : h.doneToday ? (
                      <Check className="size-5 text-emerald" />
                    ) : (
                      <Flame className="size-4 text-muted-foreground" />
                    )}
                  </ProgressRing>
                </button>
                <Link
                  to="/habits/$id"
                  params={{ id: h.id }}
                  className="flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{h.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${DIFFICULTY_STYLES[h.difficulty]}`}>{h.difficulty}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span>🔥 {h.current_streak} streak</span>
                    <span>🏆 {h.longest_streak} best</span>
                    <span>{consistency}% / 30d</span>
                    {h.reminder_time && <span className="flex items-center gap-1"><Bell className="size-3" /> {h.reminder_time.slice(0, 5)}</span>}
                  </div>
                </Link>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                  <button onClick={() => setEditId(h.id)} aria-label={`Edit ${h.name}`} className="text-muted-foreground hover:text-foreground p-1.5">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => remove.mutate(h.id)} aria-label={`Delete ${h.name}`} className="text-muted-foreground hover:text-destructive p-1.5">
                    <Trash2 className="size-4" />
                  </button>
                  <Link to="/habits/$id" params={{ id: h.id }} aria-label={`Open ${h.name}`} className="text-muted-foreground hover:text-foreground p-1.5">
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
              {/* Weekly target */}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${weekPct}%`, background: `var(--color-${h.color || "emerald"})` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{h.weekCount}/{h.target_per_week} this week</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}