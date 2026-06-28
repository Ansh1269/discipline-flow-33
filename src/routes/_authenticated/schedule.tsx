import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, formatTime } from "@/lib/date";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Schedule — DisciplineOS" }] }),
  component: Schedule,
});

const CATEGORIES = ["morning_routine","workout","meditation","study","office","reading","finance","learning","deep_work","meals","family","sleep","other"] as const;
const PRIORITIES = ["low","medium","high","critical"] as const;

function Schedule() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", category: "other" as typeof CATEGORIES[number], priority: "medium" as typeof PRIORITIES[number], start_time: "", end_time: "" });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", date],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("scheduled_date", date).order("start_time", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        user_id: u.user!.id,
        title: form.title.trim(),
        notes: form.notes || null,
        category: form.category,
        priority: form.priority,
        scheduled_date: date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", date] });
      setOpen(false);
      setForm({ title: "", notes: "", category: "other", priority: "medium", start_time: "", end_time: "" });
      toast.success("Task added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggle = useMutation({
    mutationFn: async (task: { id: string; status: string }) => {
      const next = task.status === "completed" ? "pending" : "completed";
      const { error } = await supabase.from("tasks").update({
        status: next,
        completed_at: next === "completed" ? new Date().toISOString() : null,
      }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", date] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", date] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Plan and conquer your day.</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-emerald hover:bg-emerald/90 text-emerald-foreground font-semibold"><Plus className="size-4" /> Add task</Button>
        </DialogTrigger>
        <DialogContent className="glass border-white/10">
          <DialogHeader><DialogTitle className="font-display">New task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Deep work — Project X" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as typeof CATEGORIES[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as typeof PRIORITIES[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => addTask.mutate()} disabled={!form.title.trim() || addTask.isPending} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Create task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {tasks.length === 0 && <p className="text-center text-muted-foreground py-12">No tasks for this day yet.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="glass-soft rounded-2xl p-4 flex items-center gap-3 group">
            <button onClick={() => toggle.mutate({ id: t.id, status: t.status })}>
              <StatusDot status={t.status as never} />
            </button>
            <div className="flex-1 min-w-0">
              <div className={`font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                {t.start_time && <span>{formatTime(t.start_time)}{t.end_time ? `–${formatTime(t.end_time)}` : ""}</span>}
                <span className="px-1.5 py-0.5 rounded bg-white/5">{t.category.replace("_", " ")}</span>
                <span className={`px-1.5 py-0.5 rounded ${t.priority === "critical" ? "bg-destructive/15 text-destructive" : t.priority === "high" ? "bg-orange/15 text-orange" : "bg-white/5"}`}>{t.priority}</span>
              </div>
              {t.notes && <div className="text-xs text-muted-foreground mt-1">{t.notes}</div>}
            </div>
            <button onClick={() => remove.mutate(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}