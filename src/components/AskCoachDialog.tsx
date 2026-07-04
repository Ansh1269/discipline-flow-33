import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, BookmarkPlus, ListChecks, TrendingUp, Lightbulb, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { analyzeItem } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";

type Action = "summarize" | "action_items" | "improvements" | "insights";

const ACTIONS: { value: Action; label: string; icon: typeof FileText; hint: string }[] = [
  { value: "summarize", label: "Summarize", icon: FileText, hint: "3–5 tight bullets" },
  { value: "action_items", label: "Action items", icon: ListChecks, hint: "Concrete checklist" },
  { value: "improvements", label: "Suggest improvements", icon: TrendingUp, hint: "Specific upgrades" },
  { value: "insights", label: "Convert to insights", icon: Lightbulb, hint: "Insight → action" },
];

export function AskCoachDialog({
  open,
  onClose,
  source,
  id,
  title,
}: {
  open: boolean;
  onClose: () => void;
  source: "note" | "journal";
  id: string;
  title: string;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const runAnalyze = useServerFn(analyzeItem);

  const analyze = useMutation({
    mutationFn: async (a: Action) => runAnalyze({ data: { source, id, action: a } }),
    onSuccess: (res, a) => {
      if (!res.ok) { toast.error(res.message); return; }
      setAction(a);
      setResult(res.message);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Coach failed"),
  });

  const savePlan = useMutation({
    mutationFn: async (content: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const heading = ACTIONS.find((x) => x.value === action)?.label ?? "Coach analysis";
      const { error } = await supabase.from("action_plans").insert({
        user_id: u.user.id,
        title: `${heading} — ${title}`.slice(0, 100),
        content,
        source: "coach",
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Saved to action plans"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function handleClose() {
    setAction(null);
    setResult(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald" /> Ask the coach
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">About: {title}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            const active = action === a.value;
            return (
              <button
                key={a.value}
                onClick={() => analyze.mutate(a.value)}
                disabled={analyze.isPending}
                className={`text-left p-3 rounded-xl border transition disabled:opacity-50 ${active ? "border-emerald bg-emerald/10" : "border-border hover:border-emerald/50 hover:bg-accent/10"}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-emerald" /> {a.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{a.hint}</div>
              </button>
            );
          })}
        </div>

        {analyze.isPending && (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Coach is thinking…</div>
        )}

        {result && !analyze.isPending && (
          <div className="glass-soft rounded-xl p-3 max-h-[50vh] overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => savePlan.mutate(result)} disabled={savePlan.isPending}>
                <BookmarkPlus className="size-3.5" /> Save as plan
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}