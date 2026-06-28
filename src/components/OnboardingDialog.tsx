import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Target, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "disciplineos:onboarded:v1";

const STARTER_HABITS: { name: string; icon: string; color: string; difficulty: "easy" | "medium" | "hard"; target: number }[] = [
  { name: "Drink water", icon: "💧", color: "#3b82f6", difficulty: "easy", target: 7 },
  { name: "Exercise", icon: "🏃", color: "#10b981", difficulty: "medium", target: 4 },
  { name: "Read", icon: "📚", color: "#a855f7", difficulty: "easy", target: 5 },
  { name: "Meditate", icon: "🧘", color: "#f59e0b", difficulty: "easy", target: 5 },
  { name: "Deep work", icon: "🎯", color: "#ef4444", difficulty: "hard", target: 5 },
  { name: "Journal", icon: "✍️", color: "#06b6d4", difficulty: "easy", target: 7 },
];

type Props = { userId: string; email: string };

export function OnboardingDialog({ userId, email }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
  const [picks, setPicks] = useState<Set<string>>(new Set(["Drink water", "Exercise", "Read"]));

  const { data: gate } = useQuery({
    queryKey: ["onboarding-gate", userId],
    queryFn: async () => {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      return { profile, habitCount: count ?? 0 };
    },
  });

  useEffect(() => {
    if (!gate) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const defaultName = email.split("@")[0] ?? "";
    const looksUnset = !gate.profile?.display_name || gate.profile.display_name === defaultName;
    if (looksUnset || gate.habitCount === 0) {
      setName(gate.profile?.display_name ?? defaultName);
      setOpen(true);
    } else {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  }, [gate, email]);

  const finish = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim() || (email.split("@")[0] ?? "Friend");
      await supabase.from("profiles").update({ display_name: trimmedName }).eq("id", userId);
      await supabase.from("settings").update({ week_start: weekStart, time_format: timeFormat }).eq("user_id", userId);
      if ((gate?.habitCount ?? 0) === 0 && picks.size > 0) {
        const rows = STARTER_HABITS.filter((h) => picks.has(h.name)).map((h) => ({
          user_id: userId,
          name: h.name,
          icon: h.icon,
          color: h.color,
          difficulty: h.difficulty,
          target_per_week: h.target,
        }));
        if (rows.length) await supabase.from("habits").insert(rows as never);
      }
    },
    onSuccess: () => {
      window.localStorage.setItem(STORAGE_KEY, "1");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["habits"] });
      setOpen(false);
      toast.success("You're all set — welcome aboard");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save setup"),
  });

  function close() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function togglePick(n: string) {
    setPicks((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="size-10 rounded-xl bg-emerald/15 grid place-items-center mb-2">
            <Sparkles className="size-5 text-emerald" />
          </div>
          <DialogTitle className="font-display text-2xl">
            {step === 0 && "Welcome to DisciplineOS"}
            {step === 1 && "A few preferences"}
            {step === 2 && "Pick your starter habits"}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && "Build daily discipline through habits, schedules, streaks, and AI insights."}
            {step === 1 && "You can change these anytime in Settings."}
            {step === 2 && "We'll add these to your tracker. Skip any you don't want."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 0 && (
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">What should we call you?</Label>
              <Input
                id="onboarding-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Week starts on</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 1, l: "Monday" },
                    { v: 0, l: "Sunday" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setWeekStart(o.v as 0 | 1)}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${weekStart === o.v ? "border-emerald bg-emerald/10 text-emerald" : "border-border hover:bg-accent/10"}`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Time format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: "24h", l: "24-hour" },
                    { v: "12h", l: "12-hour" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setTimeFormat(o.v as "12h" | "24h")}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${timeFormat === o.v ? "border-emerald bg-emerald/10 text-emerald" : "border-border hover:bg-accent/10"}`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-2">
              {STARTER_HABITS.map((h) => {
                const active = picks.has(h.name);
                return (
                  <button
                    key={h.name}
                    type="button"
                    onClick={() => togglePick(h.name)}
                    aria-pressed={active}
                    className={`relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-left transition ${active ? "border-emerald bg-emerald/10" : "border-border hover:bg-accent/10"}`}
                  >
                    <span className="text-lg shrink-0">{h.icon}</span>
                    <span className="min-w-0 truncate">{h.name}</span>
                    {active && <Check className="size-3.5 text-emerald ml-auto shrink-0" />}
                  </button>
                );
              })}
              {(gate?.habitCount ?? 0) > 0 && (
                <p className="col-span-2 text-[11px] text-muted-foreground">
                  You already have habits — we'll only add what you select here.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:flex-row gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="sm:mr-auto">
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={close} className="sm:mr-auto text-muted-foreground">
              Skip
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => finish.mutate()} disabled={finish.isPending} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">
              <Target className="size-4" /> {finish.isPending ? "Setting up…" : "Get started"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}