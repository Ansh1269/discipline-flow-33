import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are DisciplineOS Coach, an elite-but-warm productivity coach.
Speak directly to the user in second person. Be concise, specific, and motivating.
Cite their actual numbers. End with one concrete action for tomorrow.
Avoid generic platitudes. Use short paragraphs, no markdown headers.`;

async function loadStats(supabase: any, days: number) {
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
  const done = tasks.filter((t: any) => t.status === "completed").length;
  const missed = tasks.filter((t: any) => t.status === "missed" || t.status === "late").length;
  const focusMin = focus.reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
  const deepMin = focus.filter((f: any) => f.is_deep_work).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0);
  const byCategory: Record<string, { done: number; total: number }> = {};
  for (const t of tasks as any[]) {
    const k = t.category;
    byCategory[k] ??= { done: 0, total: 0 };
    byCategory[k].total += 1;
    if (t.status === "completed") byCategory[k].done += 1;
  }
  return {
    window_days: days,
    tasks_total: tasks.length,
    tasks_done: done,
    tasks_missed: missed,
    completion_rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    focus_hours: Math.round((focusMin / 60) * 10) / 10,
    deep_work_hours: Math.round((deepMin / 60) * 10) / 10,
    habits: habits.map((h: any) => ({ name: h.name, streak: h.current_streak, best: h.longest_streak })),
    by_category: byCategory,
  };
}

async function callGateway(messages: { role: string; content: any }[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false as const, message: "AI Gateway not configured." };
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (resp.status === 429) return { ok: false as const, message: "Rate limit — try again in a minute." };
  if (resp.status === 402) return { ok: false as const, message: "AI credits required. Add credits in the workspace." };
  if (!resp.ok) return { ok: false as const, message: `AI error: ${resp.status}` };
  const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return { ok: true as const, message: json.choices?.[0]?.message?.content ?? "No response." };
}

export const generateCoachReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ period: z.enum(["week", "month"]).default("week") }).parse(d))
  .handler(async ({ data, context }) => {
    const days = data.period === "week" ? 7 : 30;
    const payload = { period: data.period, ...(await loadStats(context.supabase, days)) };
    const res = await callGateway([
      { role: "system", content: SYSTEM },
      { role: "user", content: `Here is my last ${days} days of data as JSON:\n\n${JSON.stringify(payload, null, 2)}\n\nWrite a ${data.period === "week" ? "weekly" : "monthly"} report with: (1) one-paragraph honest summary, (2) what's working, (3) what's slipping, (4) one concrete focus for the next ${data.period}.` },
    ]);
    return { ...res, stats: payload };
  });

export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(4000),
            images: z.array(z.string().max(8_000_000)).max(4).optional(),
          }),
        )
        .min(1)
        .max(40),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const stats = await loadStats(context.supabase, 14);
    const sys = `${SYSTEM}\n\nUser's last 14 days of stats (JSON, for grounding — do not dump verbatim):\n${JSON.stringify(stats)}`;
    const msgs: any[] = [{ role: "system", content: sys }];
    for (const m of data.messages) {
      if (m.images && m.images.length) {
        const parts: any[] = [];
        if (m.content) parts.push({ type: "text", text: m.content });
        for (const url of m.images) parts.push({ type: "image_url", image_url: { url } });
        msgs.push({ role: m.role, content: parts });
      } else {
        msgs.push({ role: m.role, content: m.content });
      }
    }
    return await callGateway(msgs);
  });

const INSIGHT_KINDS = ["schedule", "habits", "weak_areas", "weekly_plan", "celebrate"] as const;
type InsightKind = (typeof INSIGHT_KINDS)[number];

const INSIGHT_PROMPTS: Record<InsightKind, string> = {
  schedule: `Design an ideal time-blocked schedule for TOMORROW based on the user's recent patterns.
Format strictly as a markdown list, one block per line:
- HH:MM–HH:MM • Category — short description
Cover wake-up through wind-down. Be realistic (use their actual best categories and avoid times they routinely miss). End with one short sentence on why this version is better than last week.`,
  habits: `Recommend 2–3 high-leverage habits to add or double down on, given the data.
For each: **Habit name** — why it fits this user (1 sentence) — suggested cadence (per week) — best time of day. Avoid habits they already do well.`,
  weak_areas: `Identify the user's 2–3 weakest areas (categories, times of day, or habits) with specific numbers, then for each give one concrete fix to try this week. Be honest, not harsh.`,
  weekly_plan: `Write a one-week improvement plan with a clear theme and 3 daily focuses (Mon–Sun). Keep each day to one line. End with a success metric to check next Sunday.`,
  celebrate: `Celebrate the user's wins from the last 14 days. Call out specific streaks, categories, focus hours, or comebacks with numbers. Keep it warm and energetic, 3–5 short sentences.`,
};

export const generateCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(INSIGHT_KINDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const days = data.kind === "weekly_plan" || data.kind === "celebrate" ? 14 : 21;
    const stats = await loadStats(context.supabase, days);
    const res = await callGateway([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `My last ${days} days as JSON:\n${JSON.stringify(stats)}\n\n${INSIGHT_PROMPTS[data.kind]}`,
      },
    ]);
    return { ...res, kind: data.kind, stats };
  });
