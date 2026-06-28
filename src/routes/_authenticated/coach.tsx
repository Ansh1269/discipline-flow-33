import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Wand2, Loader2, Send, User, Bot, RefreshCw, BookmarkPlus, Trash2, ClipboardList, CalendarClock, Target, AlertTriangle, ListChecks, Trophy } from "lucide-react";
import { generateCoachReport, chatWithCoach, generateCoachInsight } from "@/lib/coach.functions";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Coach — DisciplineOS" }] }),
  component: Coach,
});

type Msg = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "disciplineos:coach:messages";
const WELCOME: Msg = {
  role: "assistant",
  content: "Hi — I'm your DisciplineOS coach. Ask me anything about your routines, habits, focus, or what to do next. I can see your last 14 days.",
};

const SUGGESTIONS = [
  "How am I doing this week?",
  "What habit should I focus on?",
  "Plan my ideal tomorrow",
  "Where am I slipping?",
];

type InsightKind = "schedule" | "habits" | "weak_areas" | "weekly_plan" | "celebrate";
const INSIGHTS: { kind: InsightKind; label: string; icon: typeof CalendarClock; tone: string }[] = [
  { kind: "schedule", label: "Plan tomorrow", icon: CalendarClock, tone: "text-emerald bg-emerald/15" },
  { kind: "habits", label: "Recommend habits", icon: Target, tone: "text-purple bg-purple/15" },
  { kind: "weak_areas", label: "Weak areas", icon: AlertTriangle, tone: "text-orange bg-orange/15" },
  { kind: "weekly_plan", label: "Weekly plan", icon: ListChecks, tone: "text-primary bg-primary/15" },
  { kind: "celebrate", label: "Celebrate wins", icon: Trophy, tone: "text-emerald bg-emerald/15" },
];

function loadMessages(): Msg[] {
  if (typeof window === "undefined") return [WELCOME];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as Msg[];
    return Array.isArray(parsed) && parsed.length ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

function Coach() {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [messages, setMessages] = useState<Msg[]>(loadMessages);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const runReport = useServerFn(generateCoachReport);
  const runChat = useServerFn(chatWithCoach);
  const runInsight = useServerFn(generateCoachInsight);
  const [insight, setInsight] = useState<{ kind: InsightKind; content: string } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota
    }
  }, [messages]);

  const ai = useMutation({
    mutationFn: async (p: "week" | "month") => runReport({ data: { period: p } }),
    onSuccess: (res) => {
      setAiReport(res.message);
      if (!res.ok) toast.error(res.message);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI request failed"),
  });

  const chat = useMutation({
    mutationFn: async (history: Msg[]) => runChat({ data: { messages: history } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.message }]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });

  const regenerate = useMutation({
    mutationFn: async (history: Msg[]) => runChat({ data: { messages: history } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: res.message }]);
      toast.success("Regenerated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Regenerate failed"),
  });

  const savePlan = useMutation({
    mutationFn: async (content: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const title = content.split("\n")[0].replace(/^[#*\-\s]+/, "").slice(0, 80) || "Coach action plan";
      const { error } = await supabase.from("action_plans").insert({ user_id: user.user.id, title, content, source: "coach" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Action plan saved");
      qc.invalidateQueries({ queryKey: ["action-plans"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const plansQuery = useQuery({
    queryKey: ["action-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("id, title, content, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["action-plans"] }),
  });

  const insightMut = useMutation({
    mutationFn: async (kind: InsightKind) => {
      const res = await runInsight({ data: { kind } });
      return { kind, res };
    },
    onSuccess: ({ kind, res }) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setInsight({ kind, content: res.message });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Insight failed"),
  });

  const busy = chat.isPending || regenerate.isPending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    chat.mutate(next);
  };

  const handleRegenerate = () => {
    const lastAssistantRevIdx = [...messages].reverse().findIndex((m) => m.role === "assistant" && m.content !== WELCOME.content);
    if (lastAssistantRevIdx === -1) {
      toast.info("Nothing to regenerate yet");
      return;
    }
    const trimmed = messages.slice(0, messages.length - 1 - lastAssistantRevIdx);
    if (!trimmed.some((m) => m.role === "user")) {
      toast.info("Send a message first");
      return;
    }
    setMessages(trimmed);
    regenerate.mutate(trimmed);
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    toast.success("Conversation cleared");
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content !== WELCOME.content);
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const activeInsight = INSIGHTS.find((i) => i.kind === insight?.kind);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald/15 grid place-items-center"><Sparkles className="size-5 text-emerald" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold">AI Coach</h1>
            <p className="text-sm text-muted-foreground">Chat with an LLM grounded in your real activity.</p>
          </div>
        </div>
      </header>

      <section className="glass rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <Wand2 className="size-4 text-emerald" /> Personalized insights
          </h2>
          {insightMut.isPending && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Generating…
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {INSIGHTS.map((i) => {
            const Icon = i.icon;
            const active = insight?.kind === i.kind;
            return (
              <button
                key={i.kind}
                onClick={() => insightMut.mutate(i.kind)}
                disabled={insightMut.isPending}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-2xl glass-soft transition hover:-translate-y-0.5 disabled:opacity-50 ${active ? "ring-2 ring-emerald/40" : ""}`}
              >
                <span className={`size-7 rounded-lg grid place-items-center ${i.tone}`}>
                  <Icon className="size-3.5" />
                </span>
                {i.label}
              </button>
            );
          })}
        </div>
        {insight && activeInsight && (
          <div className="glass-soft rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <activeInsight.icon className="size-4" /> {activeInsight.label}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => insightMut.mutate(insight.kind)}
                  disabled={insightMut.isPending}
                  className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-emerald/10 flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RefreshCw className={`size-3.5 ${insightMut.isPending ? "animate-spin" : ""}`} /> Regenerate
                </button>
                <button
                  onClick={() => savePlan.mutate(`${activeInsight.label}\n\n${insight.content}`)}
                  disabled={savePlan.isPending}
                  className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-purple/10 flex items-center gap-1.5 disabled:opacity-40"
                >
                  <BookmarkPlus className="size-3.5" /> Save
                </button>
              </div>
            </div>
            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-2 [&_strong]:text-foreground">
              <ReactMarkdown>{insight.content}</ReactMarkdown>
            </div>
          </div>
        )}
        {!insight && !insightMut.isPending && (
          <p className="text-xs text-muted-foreground">Tap a card to get a tailored insight grounded in your last 2–3 weeks of data.</p>
        )}
      </section>

      <div className="glass rounded-3xl p-4 flex flex-col" style={{ height: "min(70vh, 600px)" }}>
        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-border/50">
          <div className="text-xs text-muted-foreground">{userMsgCount} message{userMsgCount === 1 ? "" : "s"}</div>
          <div className="flex gap-1">
            <button
              onClick={handleRegenerate}
              disabled={busy || !lastAssistant}
              title="Regenerate last response"
              className="text-xs px-2.5 py-1.5 rounded-lg glass-soft hover:bg-emerald/10 disabled:opacity-40 flex items-center gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${regenerate.isPending ? "animate-spin" : ""}`} /> Regenerate
            </button>
            <button
              onClick={() => lastAssistant && savePlan.mutate(lastAssistant.content)}
              disabled={!lastAssistant || savePlan.isPending}
              title="Save as action plan"
              className="text-xs px-2.5 py-1.5 rounded-lg glass-soft hover:bg-purple/10 disabled:opacity-40 flex items-center gap-1.5"
            >
              <BookmarkPlus className="size-3.5" /> Save plan
            </button>
            <button
              onClick={clearChat}
              disabled={busy}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="text-xs p-1.5 rounded-lg glass-soft hover:bg-red/10 disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`size-8 shrink-0 rounded-xl grid place-items-center ${m.role === "user" ? "bg-purple/15 text-purple" : "bg-emerald/15 text-emerald"}`}>
                {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "glass-soft"}`}>
                {m.role === "user" ? (
                  m.content
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_strong]:text-foreground">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2">
              <div className="size-8 rounded-xl bg-emerald/15 text-emerald grid place-items-center"><Bot className="size-4" /></div>
              <div className="glass-soft rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full glass-soft hover:bg-emerald/10 transition">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask your coach anything…"
            className="flex-1 resize-none glass-soft rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald/40 max-h-32"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground rounded-2xl size-10 shrink-0">
            <Send className="size-4" />
          </Button>
        </form>
      </div>

      {plansQuery.data && plansQuery.data.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-display font-semibold flex items-center gap-2 mb-3">
            <ClipboardList className="size-4 text-purple" /> Saved action plans
          </h2>
          <div className="space-y-2">
            {plansQuery.data.map((p) => (
              <details key={p.id} className="glass-soft rounded-2xl p-3">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); deletePlan.mutate(p.id); }}
                    className="text-muted-foreground hover:text-red p-1 rounded-lg shrink-0"
                    aria-label="Delete plan"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </summary>
                <p className="text-xs leading-relaxed whitespace-pre-wrap mt-3 text-muted-foreground">{p.content}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display font-semibold flex items-center gap-2"><Wand2 className="size-4 text-emerald" /> Generated report</h2>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setPeriod("week")} className={`px-2.5 py-1 rounded-lg ${period === "week" ? "bg-emerald/15 text-emerald" : "text-muted-foreground"}`}>Week</button>
            <button onClick={() => setPeriod("month")} className={`px-2.5 py-1 rounded-lg ${period === "month" ? "bg-emerald/15 text-emerald" : "text-muted-foreground"}`}>Month</button>
          </div>
        </div>
        {aiReport ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiReport}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Generate a structured summary of your real activity.</p>
        )}
        <Button onClick={() => ai.mutate(period)} disabled={ai.isPending} className="mt-4 bg-emerald hover:bg-emerald/90 text-emerald-foreground">
          {ai.isPending ? (<><Loader2 className="size-4 animate-spin" /> Thinking…</>) : (<><Sparkles className="size-4" /> Generate {period === "week" ? "weekly" : "monthly"} report</>)}
        </Button>
      </div>
    </div>
  );
}