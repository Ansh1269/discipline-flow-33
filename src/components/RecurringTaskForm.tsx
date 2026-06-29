import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPEAT_OPTIONS, WEEKDAY_LABELS, type RepeatType } from "@/lib/recurrence";

const CATEGORIES = ["morning_routine","workout","meditation","study","office","reading","finance","learning","deep_work","meals","family","sleep","other"] as const;
const PRIORITIES = ["low","medium","high","critical"] as const;

export type TaskFormState = {
  title: string;
  notes: string;
  category: typeof CATEGORIES[number];
  priority: typeof PRIORITIES[number];
  start_time: string;
  end_time: string;
  repeat_type: "none" | RepeatType;
  repeat_days: number[];
};

export const emptyForm: TaskFormState = {
  title: "",
  notes: "",
  category: "other",
  priority: "medium",
  start_time: "",
  end_time: "",
  repeat_type: "none",
  repeat_days: [],
};

export function TaskForm({ value, onChange }: { value: TaskFormState; onChange: (v: TaskFormState) => void }) {
  const [form, setForm] = useState(value);
  useEffect(() => setForm(value), [value]);
  function update(patch: Partial<TaskFormState>) {
    const next = { ...form, ...patch };
    setForm(next);
    onChange(next);
  }
  function toggleDay(d: number) {
    const set = new Set(form.repeat_days);
    set.has(d) ? set.delete(d) : set.add(d);
    update({ repeat_days: Array.from(set).sort() });
  }

  return (
    <div className="space-y-3">
      <div><Label>Title</Label><Input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="Morning meditation" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => update({ start_time: e.target.value })} /></div>
        <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => update({ end_time: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => update({ category: v as typeof CATEGORIES[number] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={(v) => update({ priority: v as typeof PRIORITIES[number] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Repeat</Label>
        <Select value={form.repeat_type} onValueChange={(v) => update({ repeat_type: v as TaskFormState["repeat_type"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{REPEAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {form.repeat_type === "custom" && (
        <div>
          <Label>Days</Label>
          <div className="flex gap-1.5 mt-1.5">
            {WEEKDAY_LABELS.map((label, i) => {
              const active = form.repeat_days.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`size-9 rounded-full text-xs font-medium transition ${active ? "bg-emerald text-emerald-foreground" : "glass-soft text-muted-foreground hover:text-foreground"}`}
                >
                  {label[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} /></div>
    </div>
  );
}