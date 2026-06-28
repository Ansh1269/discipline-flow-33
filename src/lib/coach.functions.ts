import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are DisciplineOS Coach, an elite-but-warm productivity coach.
Speak directly to the user in second person. Be concise, specific, and motivating.
Cite their actual numbers. End with one concrete action for tomorrow.
Avoid generic platitudes. Use short paragraphs, no markdown headers.`;

export const generateCoachReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ period: z.enum(["week", "month"]).default("week") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const days = data.period === "week" ? 7 : 30;
    const startD = new Date();
    startD.setDate(startD.getDate() - days);
    const start = startD.toISOString().slice(0, 10);

    const [tasksRes, focusRes, habitsRes] = await Promise.all([
      supabase.from("tasks").select("status, category, scheduled_date, priority").gte("scheduled_date", start),
      supabase.from("focus_sessions").select("duration_minutes, session_date, is_deep_work").gte("session_date", start),
      supabase.from("habits").select("name, current_streak, longest_streak").eq("archived", false),
    ]);

    const tasks = tasksRes.data ?? [];
    const focus = focusRes.data ?? [];
    const habits = habitsRes.data ?? [];

    const done = tasks.filter((t) => t.status === "completed").length;
    const missed = tasks.filter((t) => t.status === "missed" || t.status === "late").length;
    const focusMin = focus.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
    const deepMin = focus.filter((f) => f.is_deep_work).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
    const byCategory = tasks.reduce<Record<string, { done: number; total: number }>>((acc, t) => {
      const k = t.category;
      acc[k] ??= { done: 0, total: 0 };
      acc[k].total += 1;
      if (t.status === "completed") acc[k].done += 1;
      return acc;
    }, {});

    const payload = {
      period: data.period,
      window_days: days,
      tasks_total: tasks.length,
      tasks_done: done,
      tasks_missed: missed,
      completion_rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      focus_hours: Math.round((focusMin / 60) * 10) / 10,
      deep_work_hours: Math.round((deepMin / 60) * 10) / 10,
      habits: habits.map((h) => ({ name: h.name, streak: h.current_streak, best: h.longest_streak })),
      by_category: byCategory,
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, message: "AI Gateway not configured.", stats: payload };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Here is my last ${days} days of data as JSON:\n\n${JSON.stringify(payload, null, 2)}\n\nWrite a ${data.period === "week" ? "weekly" : "monthly"} report with: (1) one-paragraph honest summary, (2) what's working, (3) what's slipping, (4) one concrete focus for the next ${data.period}.`,
          },
        ],
      }),
    });

    if (resp.status === 429) return { ok: false as const, message: "Rate limit — try again in a minute.", stats: payload };
    if (resp.status === 402) return { ok: false as const, message: "AI credits required. Add credits in the workspace.", stats: payload };
    if (!resp.ok) return { ok: false as const, message: `AI error: ${resp.status}`, stats: payload };

    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "No response.";
    return { ok: true as const, message: text, stats: payload };
  });
