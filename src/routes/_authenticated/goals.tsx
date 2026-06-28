import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Target, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — DisciplineOS" }] }),
  component: Goals,
});

const PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;

function Goals() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", period: "weekly" as typeof PERIODS[number], target_value: 1 });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await supabase.from("goals").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("goals").insert({
        user_id: u.user!.id, title: form.title.trim(), period: form.period, target_value: form.target_value,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); setOpen(false); setForm({ title: "", period: "weekly", target_value: 1 }); toast.success("Goal added"); },
  });

  const bump = useMutation({
    mutationFn: async (g: { id: string; current_value: number; target_value: number }) => {
      const next = Math.min(g.current_value + 1, g.target_value);
      await supabase.from("goals").update({ current_value: next, completed: next >= g.target_value }).eq("id", g.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Goals</h1>
        <p className="text-sm text-muted-foreground">Daily, weekly, monthly, yearly.</p>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-emerald hover:bg-emerald/90 text-emerald-foreground font-semibold"><Plus className="size-4" /> New goal</Button>
        </DialogTrigger>
        <DialogContent className="glass border-white/10">
          <DialogHeader><DialogTitle className="font-display">New goal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Read 4 books" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Period</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as typeof PERIODS[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target</Label><Input type="number" min={1} value={form.target_value} onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title.trim()} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {goals.length === 0 && <p className="text-center text-muted-foreground py-12">No goals yet.</p>}
        {goals.map((g) => {
          const pct = Math.round((Number(g.current_value) / Number(g.target_value)) * 100);
          return (
            <div key={g.id} className="glass-soft rounded-2xl p-4 group">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="size-4 text-emerald shrink-0" />
                  <div className="font-medium truncate">{g.title}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 capitalize">{g.period}</span>
              </div>
              <Progress value={pct} className="h-2 mb-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{g.current_value}/{g.target_value} ({pct}%)</span>
                <div className="flex gap-2">
                  <button onClick={() => bump.mutate(g)} className="text-emerald hover:underline">+1</button>
                  <button onClick={() => remove.mutate(g.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}