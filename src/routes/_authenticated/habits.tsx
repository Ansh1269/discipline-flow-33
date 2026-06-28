import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/date";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Flame, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Habits — DisciplineOS" }] }),
  component: Habits,
});

const COLORS = ["emerald", "orange", "purple", "navy"] as const;

function Habits() {
  const qc = useQueryClient();
  const date = todayISO();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", color: "emerald" as typeof COLORS[number] });

  const { data: habits = [] } = useQuery({
    queryKey: ["habits-with-logs", date],
    queryFn: async () => {
      const { data: h } = await supabase.from("habits").select("*").eq("archived", false).order("created_at");
      const { data: logs } = await supabase.from("habit_logs").select("*").eq("log_date", date);
      return (h ?? []).map((hh) => ({ ...hh, doneToday: logs?.some((l) => l.habit_id === hh.id) ?? false }));
    },
  });

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

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("habits").insert({ user_id: u.user!.id, name: form.name.trim(), color: form.color });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-with-logs", date] });
      setOpen(false); setForm({ name: "", color: "emerald" });
      toast.success("Habit created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits-with-logs", date] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("habits").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits-with-logs", date] }),
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
        <DialogContent className="glass border-border">
          <DialogHeader><DialogTitle className="font-display">New habit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Drink 2L water" /></div>
            <div>
              <Label>Color</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v as typeof COLORS[number] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.name.trim() || create.isPending} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {habits.length === 0 && <p className="text-center text-muted-foreground py-12">No habits yet. Start with one small daily action.</p>}
        {habits.map((h) => {
          const consistency = Math.round(((monthly[h.id] ?? 0) / 30) * 100);
          return (
            <div key={h.id} className="glass-soft rounded-2xl p-4 flex items-center gap-4 group">
              <button onClick={() => toggle.mutate(h)} className="shrink-0">
                <ProgressRing value={h.doneToday ? 100 : 0} size={56} stroke={5} color={`var(--color-${h.color})`}>
                  {h.doneToday ? <Check className="size-5 text-emerald" /> : <Flame className="size-4 text-muted-foreground" />}
                </ProgressRing>
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{h.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                  <span>🔥 {h.current_streak} streak</span>
                  <span>🏆 {h.longest_streak} best</span>
                  <span>{consistency}% / 30d</span>
                </div>
              </div>
              <button onClick={() => remove.mutate(h.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}