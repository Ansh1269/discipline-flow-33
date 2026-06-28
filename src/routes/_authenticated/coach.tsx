import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Wand2, Loader2, Send, User, Bot } from "lucide-react";
import { generateCoachReport, chatWithCoach } from "@/lib/coach.functions";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Coach — DisciplineOS" }] }),
  component: Coach,
});

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = [
  "How am I doing this week?",
  "What habit should I focus on?",
  "Plan my ideal tomorrow",
  "Where am I slipping?",
];

function Coach() {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm your DisciplineOS coach. Ask me anything about your routines, habits, focus, or what to do next. I can see your last 14 days." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const runReport = useServerFn(generateCoachReport);
  const runChat = useServerFn(chatWithCoach);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    chat.mutate(next.filter((m) => m.role !== "assistant" || m.content.length < 8000));
  };

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

      <div className="glass rounded-3xl p-4 flex flex-col" style={{ height: "min(70vh, 600px)" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`size-8 shrink-0 rounded-xl grid place-items-center ${m.role === "user" ? "bg-purple/15 text-purple" : "bg-emerald/15 text-emerald"}`}>
                {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-purple/15" : "glass-soft"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {chat.isPending && (
            <div className="flex gap-2">
              <div className="size-8 rounded-xl bg-emerald/15 text-emerald grid place-items-center"><Bot className="size-4" /></div>
              <div className="glass-soft rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Thinking…</div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full glass-soft hover:bg-emerald/10 transition">{s}</button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="mt-3 flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Ask your coach anything…"
            className="flex-1 resize-none glass-soft rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald/40 max-h-32"
          />
          <Button type="submit" size="icon" disabled={chat.isPending || !input.trim()} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground rounded-2xl size-10 shrink-0">
            <Send className="size-4" />
          </Button>
        </form>
      </div>

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
          {ai.isPending ? <><Loader2 className="size-4 animate-spin" /> Thinking…</> : <><Sparkles className="size-4" /> Generate {period === "week" ? "weekly" : "monthly"} report</>}
        </Button>
      </div>
    </div>
  );
}