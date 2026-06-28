import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const HABIT_COLORS = ["emerald", "orange", "purple", "navy"] as const;
export type HabitColor = (typeof HABIT_COLORS)[number];
export type HabitDifficulty = "easy" | "medium" | "hard";

export type HabitFormValues = {
  name: string;
  icon: string;
  color: HabitColor;
  difficulty: HabitDifficulty;
  target_per_week: number;
  reminder_time: string;
  notes: string;
};

export const DEFAULT_HABIT_FORM: HabitFormValues = {
  name: "",
  icon: "",
  color: "emerald",
  difficulty: "medium",
  target_per_week: 7,
  reminder_time: "",
  notes: "",
};

export function HabitForm({
  initial,
  onSubmit,
  submitLabel = "Save",
  busy,
}: {
  initial?: Partial<HabitFormValues>;
  onSubmit: (values: HabitFormValues) => void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const [form, setForm] = useState<HabitFormValues>({ ...DEFAULT_HABIT_FORM, ...initial });
  const set = <K extends keyof HabitFormValues>(k: K, v: HabitFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) onSubmit({ ...form, name: form.name.trim() }); }}
    >
      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div>
          <Label htmlFor="habit-icon">Icon</Label>
          <Input id="habit-icon" value={form.icon} onChange={(e) => set("icon", e.target.value.slice(0, 2))} placeholder="💧" className="text-center text-lg" />
        </div>
        <div>
          <Label htmlFor="habit-name">Name</Label>
          <Input id="habit-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Drink 2L water" required autoFocus />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v as HabitDifficulty)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Color</Label>
          <Select value={form.color} onValueChange={(v) => set("color", v as HabitColor)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{HABIT_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="habit-target">Days per week</Label>
          <Input id="habit-target" type="number" min={1} max={7} value={form.target_per_week} onChange={(e) => set("target_per_week", Math.max(1, Math.min(7, Number(e.target.value) || 1)))} />
        </div>
        <div>
          <Label htmlFor="habit-reminder">Reminder</Label>
          <Input id="habit-reminder" type="time" value={form.reminder_time} onChange={(e) => set("reminder_time", e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="habit-notes">Notes</Label>
        <Textarea id="habit-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Why this matters, cues, or rules…" rows={3} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!form.name.trim() || busy} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">{submitLabel}</Button>
      </div>
    </form>
  );
}

export const DIFFICULTY_STYLES: Record<HabitDifficulty, string> = {
  easy: "bg-emerald/15 text-emerald",
  medium: "bg-orange/15 text-orange",
  hard: "bg-destructive/15 text-destructive",
};