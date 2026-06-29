import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, formatTime } from "@/lib/date";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Repeat } from "lucide-react";
import { toast } from "sonner";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskDialog } from "@/components/TaskDialog";
import { TaskForm, emptyForm, type TaskFormState } from "@/components/RecurringTaskForm";
import { describeRepeat, addDaysISO, type RepeatType } from "@/lib/recurrence";
import { fetchDayTasks, dayTasksKey, invalidationKeys, type DayTask } from "@/lib/dailyTasks";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Schedule — DisciplineOS" }] }),
  component: Schedule,
});

type RecurringTask = {
  id: string; user_id: string; title: string; notes: string | null;
  category: string; priority: string;
  start_time: string | null; end_time: string | null;
  repeat_type: string; repeat_days: number[];
  starts_on: string; ends_on: string | null; position: number;
};
type Combined = DayTask;

function Schedule() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState<TaskFormState>(emptyForm);

  const [editId, setEditId] = useState<string | null>(null); // one-time rich notes dialog
  const [editRecurring, setEditRecurring] = useState<{ item: Combined } | null>(null);
  const [deleteRecurring, setDeleteRecurring] = useState<{ item: Combined } | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: dayTasksKey(date),
    queryFn: () => fetchDayTasks(date),
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("recurring_tasks" as never).select("*").order("position", { ascending: true });
      return ((data ?? []) as unknown as RecurringTask[]);
    },
  });

  function invalidateAll() {
    for (const k of invalidationKeys(date)) qc.invalidateQueries({ queryKey: k as unknown as readonly unknown[] });
  }

  // ---- Create ----
  const createTask = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;
      const f = createForm;
      if (!f.title.trim()) throw new Error("Title required");

      if (f.repeat_type === "none") {
        const { error } = await supabase.from("tasks").insert({
          user_id: userId, title: f.title.trim(), notes: f.notes || null,
          category: f.category, priority: f.priority, scheduled_date: date,
          start_time: f.start_time || null, end_time: f.end_time || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_tasks" as never).insert({
          user_id: userId, title: f.title.trim(), notes: f.notes || null,
          category: f.category, priority: f.priority,
          start_time: f.start_time || null, end_time: f.end_time || null,
          repeat_type: f.repeat_type, repeat_days: f.repeat_days,
          starts_on: date,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      setOpenCreate(false); setCreateForm(emptyForm);
      toast.success("Task added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ---- Toggle complete ----
  const toggle = useMutation({
    mutationFn: async (item: Combined) => {
      const next = item.status === "completed" ? "pending" : "completed";
      if (item.kind === "one") {
        const { error } = await supabase.from("tasks").update({
          status: next, completed_at: next === "completed" ? new Date().toISOString() : null,
        }).eq("id", item.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const payload = {
          user_id: u.user!.id,
          recurring_task_id: item.recurring_id!,
          occurrence_date: date,
          status: next,
          completed_at: next === "completed" ? new Date().toISOString() : null,
        };
        const { error } = await supabase.from("recurring_task_logs" as never)
          .upsert(payload as never, { onConflict: "recurring_task_id,occurrence_date" });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAll(),
  });

  // ---- Reorder ----
  const reorder = useMutation({
    mutationFn: async (ordered: Combined[]) => {
      await Promise.all(ordered.map((it, i) => {
        const table = it.kind === "one" ? "tasks" : "recurring_tasks";
        return supabase.from(table as never).update({ position: i } as never).eq("id", it.id);
      }));
    },
    onSuccess: () => invalidateAll(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.key === active.id);
    const newIndex = items.findIndex((i) => i.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items.slice(), oldIndex, newIndex);
    reorder.mutate(next);
  }

  const editingOneTime = items.find((t) => t.kind === "one" && t.id === editId) ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Plan and conquer your day.</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-accent/10 border border-border rounded-xl px-3 py-2 text-sm" />
      </header>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 bg-emerald hover:bg-emerald/90 text-emerald-foreground font-semibold"><Plus className="size-4" /> Add task</Button>
        </DialogTrigger>
        <DialogContent className="glass border-border max-h-[90svh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New task</DialogTitle></DialogHeader>
          <TaskForm value={createForm} onChange={setCreateForm} />
          <DialogFooter>
            <Button onClick={() => createTask.mutate()} disabled={!createForm.title.trim() || createTask.isPending}
              className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Create task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-center text-muted-foreground py-12">No tasks for this day yet.</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
            {items.map((it) => (
              <SortableRow
                key={it.key}
                item={it}
                onToggle={() => toggle.mutate(it)}
                onEdit={() => it.kind === "one" ? setEditId(it.id) : setEditRecurring({ item: it })}
                onDelete={() => it.kind === "one" ? deleteOneTime(it.id) : setDeleteRecurring({ item: it })}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <TaskDialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)} task={editingOneTime as never} dateKey={date} />

      {editRecurring && (
        <EditRecurringDialog
          open={true}
          onOpenChange={(v) => !v && setEditRecurring(null)}
          item={editRecurring.item}
          recurring={recurring.find((r) => r.id === editRecurring.item.recurring_id)!}
          date={date}
          onDone={() => {
            setEditRecurring(null);
            invalidateAll();
          }}
        />
      )}

      {deleteRecurring && (
        <DeleteRecurringDialog
          open={true}
          onOpenChange={(v) => !v && setDeleteRecurring(null)}
          item={deleteRecurring.item}
          date={date}
          onDone={() => {
            setDeleteRecurring(null);
            invalidateAll();
          }}
        />
      )}
    </div>
  );

  async function deleteOneTime(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidateAll();
    toast.success("Deleted");
  }
}

function SortableRow({ item, onToggle, onEdit, onDelete }: { item: Combined; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="glass-soft rounded-2xl p-4 flex items-center gap-3 group">
      <button {...attributes} {...listeners} className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing" aria-label="Drag"><GripVertical className="size-4" /></button>
      <button onClick={onToggle}><StatusDot status={item.status as never} /></button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className={`font-medium flex items-center gap-1.5 ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
          {item.title}
          {item.kind === "recur" && <Repeat className="size-3 text-emerald shrink-0" aria-label="Recurring" />}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
          {item.start_time && <span>{formatTime(item.start_time)}{item.end_time ? `–${formatTime(item.end_time)}` : ""}</span>}
          <span className="px-1.5 py-0.5 rounded bg-accent/10">{item.category.replace("_", " ")}</span>
          <span className={`px-1.5 py-0.5 rounded ${item.priority === "critical" ? "bg-destructive/15 text-destructive" : item.priority === "high" ? "bg-orange/15 text-orange" : "bg-accent/10"}`}>{item.priority}</span>
          {item.kind === "recur" && <span className="px-1.5 py-0.5 rounded bg-emerald/10 text-emerald">{describeRepeat({ repeat_type: item.repeat_type!, repeat_days: item.repeat_days ?? [] })}</span>}
        </div>
        {item.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.notes}</div>}
      </button>
      <button onClick={onDelete} aria-label="Delete task" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"><Trash2 className="size-4" /></button>
    </div>
  );
}

// ============== Edit recurring dialog ==============
function EditRecurringDialog({ open, onOpenChange, item, recurring, date, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  item: Combined; recurring: RecurringTask; date: string; onDone: () => void;
}) {
  const [scope, setScope] = useState<"only" | "future" | "series">("only");
  const [form, setForm] = useState<TaskFormState>({
    title: item.title,
    notes: item.notes ?? "",
    category: item.category as TaskFormState["category"],
    priority: item.priority as TaskFormState["priority"],
    start_time: item.start_time ?? "",
    end_time: item.end_time ?? "",
    repeat_type: (recurring.repeat_type as RepeatType) ?? "daily",
    repeat_days: recurring.repeat_days ?? [],
  });

  async function save() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (scope === "only") {
        const payload = {
          user_id: u.user!.id,
          recurring_task_id: recurring.id,
          occurrence_date: date,
          override_title: form.title,
          override_start_time: form.start_time || null,
          override_end_time: form.end_time || null,
          override_notes: form.notes || null,
        };
        const { error } = await supabase.from("recurring_task_logs" as never)
          .upsert(payload as never, { onConflict: "recurring_task_id,occurrence_date" });
        if (error) throw error;
      } else if (scope === "series") {
        const { error } = await supabase.from("recurring_tasks" as never).update({
          title: form.title, notes: form.notes || null,
          category: form.category, priority: form.priority,
          start_time: form.start_time || null, end_time: form.end_time || null,
          repeat_type: form.repeat_type === "none" ? "daily" : form.repeat_type,
          repeat_days: form.repeat_days,
        } as never).eq("id", recurring.id);
        if (error) throw error;
      } else {
        // future: end old series the day before, create a new series from `date`
        const prevDay = addDaysISO(date, -1);
        const { error: e1 } = await supabase.from("recurring_tasks" as never)
          .update({ ends_on: prevDay } as never).eq("id", recurring.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("recurring_tasks" as never).insert({
          user_id: u.user!.id, title: form.title, notes: form.notes || null,
          category: form.category, priority: form.priority,
          start_time: form.start_time || null, end_time: form.end_time || null,
          repeat_type: form.repeat_type === "none" ? "daily" : form.repeat_type,
          repeat_days: form.repeat_days,
          starts_on: date,
          position: recurring.position,
        } as never);
        if (e2) throw e2;
      }
      toast.success("Updated");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit recurring task</DialogTitle>
          <DialogDescription>Choose which occurrences to update.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 mb-2">
          {([["only","Edit only this occurrence"],["future","Edit this and future occurrences"],["series","Edit the entire series"]] as const).map(([v,l]) => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} className="accent-emerald" />
              {l}
            </label>
          ))}
        </div>
        <TaskForm value={form} onChange={setForm} />
        <DialogFooter>
          <Button onClick={save} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Delete recurring dialog ==============
function DeleteRecurringDialog({ open, onOpenChange, item, date, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; item: Combined; date: string; onDone: () => void;
}) {
  const [scope, setScope] = useState<"only" | "future" | "series">("only");
  async function run() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (scope === "only") {
        const payload = {
          user_id: u.user!.id,
          recurring_task_id: item.recurring_id!,
          occurrence_date: date,
          skipped: true,
        };
        const { error } = await supabase.from("recurring_task_logs" as never)
          .upsert(payload as never, { onConflict: "recurring_task_id,occurrence_date" });
        if (error) throw error;
      } else if (scope === "future") {
        const prev = addDaysISO(date, -1);
        const { error } = await supabase.from("recurring_tasks" as never)
          .update({ ends_on: prev } as never).eq("id", item.recurring_id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_tasks" as never).delete().eq("id", item.recurring_id!);
        if (error) throw error;
      }
      toast.success("Deleted");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Delete recurring task</DialogTitle>
          <DialogDescription>Choose what to delete.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {([["only","Delete only today"],["future","Delete this and future occurrences"],["series","Delete the entire series"]] as const).map(([v,l]) => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="del-scope" checked={scope === v} onChange={() => setScope(v)} className="accent-emerald" />
              {l}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={run}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}