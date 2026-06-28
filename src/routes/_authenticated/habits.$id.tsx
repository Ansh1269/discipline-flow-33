import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Bell, Flame, Trophy, Calendar, Trash2, Pencil, Archive, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { ProgressRing } from "@/components/ProgressRing";
import { HabitForm, DIFFICULTY_STYLES, type HabitFormValues } from "@/components/HabitForm";
import { todayISO } from "@/lib/date";
import { startOfWeek, isoDate } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/habits/$id")({
  head: () => ({ meta: [{ title: "Habit — DisciplineOS" }] }),
  component: HabitDetail,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive" role="alert">Couldn't load habit: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Habit not found.</div>,
});

function HabitDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const today = todayISO();

  const habitQ = useQuery({
    queryKey: ["habit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const logsQ = useQuery({
    queryKey: ["habit-logs", id],
    queryFn: async () => {
      const start = new Date(); start.setDate(start.getDate() - 365);
      const { data, error } = await supabase
        .from("habit_logs")
        .select("log_date")
        .eq("habit_id", id)
        .gte("log_date", start.toISOString().slice(0, 10))
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const habit = habitQ.data;
  const logs = logsQ.data ?? [];
  const doneToday = logs.some((l) => l.log_date === today);
  const weekStart = isoDate(startOfWeek(new Date(), 1));
  const weekCount = logs.filter((l) => l.log_date >= weekStart).length;
  const monthStart = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const monthCount = logs.filter((l) => l.log_date >= monthStart).length;
  const yearCount = logs.length;

  const heatData: Record<string, number> = {};
  logs.forEach((l) => { heatData[l.log_date] = 1; });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!habit) return;
      const { data: u } = await supabase.auth.getUser();
      if (doneToday) {
        await supabase.from("habit_logs").delete().eq("habit_id", id).eq("log_date", today);
        await supabase.from("habits").update({ current_streak: Math.max(0, habit.current_streak - 1) }).eq("id", id);
      } else {
        await supabase.from("habit_logs").insert({ user_id: u.user!.id, habit_id: id, log_date: today });
        const next = habit.current_streak + 1;
        await supabase.from("habits").update({ current_streak: next, longest_streak: Math.max(habit.longest_streak, next) }).eq("id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit", id] });
      qc.invalidateQueries({ queryKey: ["habit-logs", id] });
      qc.invalidateQueries({ queryKey: ["habits-with-logs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update"),
  });

  const update = useMutation({
    mutationFn: async (values: HabitFormValues) => {
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
      qc.invalidateQueries({ queryKey: ["habit", id] });
      qc.invalidateQueries({ queryKey: ["habits-with-logs"] });
      setEditing(false);
      toast.success("Habit updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update habit"),
  });

  const archive = useMutation({
    mutationFn: async () => {
      if (!habit) return;
      const { error } = await supabase.from("habits").update({ archived: !habit.archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit", id] });
      qc.invalidateQueries({ queryKey: ["habits-with-logs"] });
      toast.success(habit?.archived ? "Habit restored" : "Habit archived");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-with-logs"] });
      toast.success("Habit removed");
      void navigate({ to: "/habits", replace: true });
    },
  });

  if (habitQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (!habit) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.history.back()} className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="size-4" /> Back</button>
        <p className="text-muted-foreground">Habit not found.</p>
      </div>
    );
  }

  const weekPct = Math.min(100, Math.round((weekCount / habit.target_per_week) * 100));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Link to="/habits" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="size-4" /> All habits
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit habit"><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => archive.mutate()} aria-label={habit.archived ? "Restore habit" : "Archive habit"}><Archive className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this habit and its history?")) remove.mutate(); }} aria-label="Delete habit"><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>

      <header className="glass rounded-3xl p-6 flex items-center gap-5">
        <button
          onClick={() => toggle.mutate()}
          aria-label={doneToday ? "Mark not done" : "Mark done for today"}
          className="transition-transform active:scale-90"
        >
          <ProgressRing value={doneToday ? 100 : 0} size={88} stroke={8} color={`var(--color-${habit.color || "emerald"})`}>
            {habit.icon ? (
              <span className="text-2xl" aria-hidden>{habit.icon}</span>
            ) : doneToday ? (
              <Check className="size-7 text-emerald" />
            ) : (
              <Flame className="size-6 text-muted-foreground" />
            )}
          </ProgressRing>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold truncate">{habit.name}</h1>
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${DIFFICULTY_STYLES[habit.difficulty]}`}>{habit.difficulty}</span>
            {habit.archived && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Archived</span>}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span>Target {habit.target_per_week}×/week</span>
            {habit.reminder_time && <span className="inline-flex items-center gap-1"><Bell className="size-3" /> {habit.reminder_time.slice(0, 5)}</span>}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} tone="text-orange" label="Current" value={`${habit.current_streak}`} suffix=" d" />
        <Stat icon={Trophy} tone="text-emerald" label="Longest" value={`${habit.longest_streak}`} suffix=" d" />
        <Stat icon={Calendar} tone="text-purple" label="30-day" value={`${Math.round((monthCount / 30) * 100)}`} suffix="%" />
        <Stat icon={Calendar} tone="text-emerald" label="Year" value={`${yearCount}`} suffix=" done" />
      </section>

      <section className="glass rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">This week</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{weekCount}/{habit.target_per_week} days</span>
        </div>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${weekPct}%`, background: `var(--color-${habit.color || "emerald"})` }}
          />
        </div>
      </section>

      <section className="glass rounded-3xl p-5 space-y-3 overflow-x-auto">
        <h2 className="font-display font-semibold">Last 12 weeks</h2>
        <ActivityHeatmap data={heatData} weeks={12} />
      </section>

      {habit.notes && (
        <section className="glass-soft rounded-2xl p-4 whitespace-pre-wrap text-sm leading-relaxed">
          {habit.notes}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display font-semibold">Recent completions</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completions yet — mark today done to start your streak.</p>
        ) : (
          <ul className="space-y-1.5">
            {logs.slice(0, 14).map((l) => (
              <li key={l.log_date} className="glass-soft rounded-xl px-3 py-2 text-sm flex items-center justify-between">
                <span>{new Date(l.log_date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                <Check className="size-4 text-emerald" aria-hidden />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="glass border-border max-h-[90svh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Edit habit</DialogTitle></DialogHeader>
          <HabitForm
            initial={{
              name: habit.name,
              icon: habit.icon || "",
              color: (habit.color as HabitFormValues["color"]) || "emerald",
              difficulty: habit.difficulty,
              target_per_week: habit.target_per_week,
              reminder_time: habit.reminder_time?.slice(0, 5) || "",
              notes: habit.notes || "",
            }}
            onSubmit={(v) => update.mutate(v)}
            submitLabel="Save changes"
            busy={update.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value, suffix }: { icon: typeof Flame; tone: string; label: string; value: string; suffix?: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <Icon className={`size-4 ${tone}`} aria-hidden />
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-0.5 tabular-nums">{value}<span className="text-xs text-muted-foreground font-normal">{suffix}</span></div>
    </div>
  );
}