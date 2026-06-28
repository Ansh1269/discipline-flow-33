import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Droplet, Dumbbell, Moon, BookOpen, Pill, Calendar, Briefcase } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders — DisciplineOS" }] }),
  component: Reminders,
});

const KINDS = [
  { v: "custom", label: "Custom", icon: Bell },
  { v: "task", label: "Task", icon: Calendar },
  { v: "habit", label: "Habit", icon: Bell },
  { v: "water", label: "Water", icon: Droplet },
  { v: "workout", label: "Workout", icon: Dumbbell },
  { v: "sleep", label: "Sleep", icon: Moon },
  { v: "study", label: "Study", icon: BookOpen },
  { v: "meeting", label: "Meeting", icon: Briefcase },
  { v: "medicine", label: "Medicine", icon: Pill },
] as const;

function Reminders() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "custom", remind_at: "", recurrence: "none" });

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders" as never).select("*").order("remind_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; title: string; kind: string; remind_at: string; recurrence: string; enabled: boolean }>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const remind_at = form.remind_at ? new Date(form.remind_at).toISOString() : new Date().toISOString();
      const { error } = await supabase.from("reminders" as never).insert({
        user_id: u.user!.id, title: form.title.trim(), kind: form.kind, remind_at, recurrence: form.recurrence,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setOpen(false); setForm({ title: "", kind: "custom", remind_at: "", recurrence: "none" });
      toast.success("Reminder set");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggle = useMutation({
    mutationFn: async (r: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("reminders" as never).update({ enabled: !r.enabled } as never).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("reminders" as never).delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  async function requestPush() {
    if (!("Notification" in window)) return toast.error("Notifications not supported");
    const perm = await Notification.requestPermission();
    if (perm === "granted") toast.success("Push notifications enabled");
    else toast.error("Permission denied");
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reminders</h1>
          <p className="text-sm text-muted-foreground">Stay on rhythm, never miss a beat.</p>
        </div>
        <Button variant="outline" onClick={requestPush} className="shrink-0"><Bell className="size-4" /> Enable push</Button>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-emerald hover:bg-emerald/90 text-emerald-foreground font-semibold"><Plus className="size-4" /> New reminder</Button>
        </DialogTrigger>
        <DialogContent className="glass border-border">
          <DialogHeader><DialogTitle className="font-display">New reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Drink water" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Repeat</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Once</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>When</Label><Input type="datetime-local" value={form.remind_at} onChange={(e) => setForm({ ...form, remind_at: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.title.trim() || create.isPending} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {reminders.length === 0 && <p className="text-center text-muted-foreground py-12">No reminders yet.</p>}
        {reminders.map((r) => {
          const K = KINDS.find((k) => k.v === r.kind) ?? KINDS[0];
          const Icon = K.icon;
          return (
            <div key={r.id} className="glass-soft rounded-2xl p-4 flex items-center gap-3 group">
              <div className="size-10 rounded-xl bg-emerald/15 text-emerald grid place-items-center"><Icon className="size-4" /></div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm truncate ${r.enabled ? "" : "text-muted-foreground line-through"}`}>{r.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(r.remind_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  {r.recurrence !== "none" && ` · ${r.recurrence}`}
                </div>
              </div>
              <Switch checked={r.enabled} onCheckedChange={() => toggle.mutate(r)} />
              <button onClick={() => remove.mutate(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}