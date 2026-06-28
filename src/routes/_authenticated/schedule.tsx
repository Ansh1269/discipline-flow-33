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
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskDialog } from "@/components/TaskDialog";

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
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", notes: "", category: "other" as typeof CATEGORIES[number], priority: "medium" as typeof PRIORITIES[number], start_time: "", end_time: "" });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", date],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("scheduled_date", date).order("position", { ascending: true, nullsFirst: false }).order("start_time", { ascending: true, nullsFirst: false });
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

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, i) => supabase.from("tasks").update({ position: i }).eq("id", id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", date] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    qc.setQueryData(["tasks", date], arrayMove(tasks.slice(), ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
    reorder.mutate(next);
  }

  const editingTask = tasks.find((t) => t.id === editId) ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Plan and conquer your day.</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-accent/10 border border-border rounded-xl px-3 py-2 text-sm" />
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-emerald hover:bg-emerald/90 text-emerald-foreground font-semibold"><Plus className="size-4" /> Add task</Button>
        </DialogTrigger>
        <DialogContent className="glass border-border">
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((t) => (
              <SortableRow key={t.id} task={t} onToggle={() => toggle.mutate({ id: t.id, status: t.status })} onRemove={() => remove.mutate(t.id)} onEdit={() => setEditId(t.id)} />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <TaskDialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)} task={editingTask as never} dateKey={date} />
    </div>
  );
}

function SortableRow({ task, onToggle, onRemove, onEdit }: { task: { id: string; title: string; status: string; start_time: string | null; end_time: string | null; category: string; priority: string; notes: string | null }; onToggle: () => void; onRemove: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="glass-soft rounded-2xl p-4 flex items-center gap-3 group">
      <button {...attributes} {...listeners} className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing" aria-label="Drag"><GripVertical className="size-4" /></button>
      <button onClick={onToggle}><StatusDot status={task.status as never} /></button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
          {task.start_time && <span>{formatTime(task.start_time)}{task.end_time ? `–${formatTime(task.end_time)}` : ""}</span>}
          <span className="px-1.5 py-0.5 rounded bg-accent/10">{task.category.replace("_", " ")}</span>
          <span className={`px-1.5 py-0.5 rounded ${task.priority === "critical" ? "bg-destructive/15 text-destructive" : task.priority === "high" ? "bg-orange/15 text-orange" : "bg-accent/10"}`}>{task.priority}</span>
        </div>
        {task.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.notes}</div>}
      </button>
      <button onClick={onRemove} aria-label="Delete task" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"><Trash2 className="size-4" /></button>
    </div>
  );
}