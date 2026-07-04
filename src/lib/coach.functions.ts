import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `You are DisciplineOS Coach, an elite-but-warm productivity coach.
Speak directly to the user in second person. Be concise, specific, and motivating.
Cite their actual numbers. End with one concrete action for tomorrow.
Avoid generic platitudes. Use short paragraphs, no markdown headers.`;

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadContent(supabase: any, days: number) {
  const startD = new Date();
  startD.setDate(startD.getDate() - days);
  const startIso = startD.toISOString();
  const [notesRes, entriesRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content, category, tags, is_favorite, is_pinned, updated_at")
      .gte("updated_at", startIso)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("journal_entries")
      .select("id, entry_date, mood, energy_level, productivity_rating, tags, accomplishments, biggest_achievement, gratitude, lessons, challenges, improvements, reflections, body, is_favorite")
      .gte("entry_date", startD.toISOString().slice(0, 10))
      .order("entry_date", { ascending: false })
      .limit(30),
  ]);
  const notes = (notesRes.data ?? []).map((n: any) => ({
    id: n.id,
    title: n.title || "Untitled",
    category: n.category,
    tags: n.tags,
    favorite: n.is_favorite,
    pinned: n.is_pinned,
    updated_at: n.updated_at,
    excerpt: stripHtml(n.content).slice(0, 500),
  }));
  const entries = (entriesRes.data ?? []).map((e: any) => ({
    id: e.id,
    date: e.entry_date,
    mood: e.mood,
    energy: e.energy_level,
    productivity: e.productivity_rating,
    tags: e.tags,
    accomplishments: (e.accomplishments ?? "").slice(0, 300),
    biggest_achievement: (e.biggest_achievement ?? "").slice(0, 300),
    gratitude: (e.gratitude ?? "").slice(0, 300),
    lessons: (e.lessons ?? "").slice(0, 300),
    challenges: (e.challenges ?? "").slice(0, 300),
    improvements: (e.improvements ?? "").slice(0, 300),
    reflections: (e.reflections ?? "").slice(0, 300),
    body: stripHtml(e.body ?? "").slice(0, 400),
  }));
  return { notes, journal: entries };
}

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
    const [stats, content] = await Promise.all([
      loadStats(context.supabase, 14),
      loadContent(context.supabase, 30),
    ]);
    const sys = `${SYSTEM}\n\nUser's last 14 days of stats (JSON, for grounding — do not dump verbatim):\n${JSON.stringify(stats)}\n\nRecent notes (last 30 days, JSON — reference by title when the user asks about them):\n${JSON.stringify(content.notes)}\n\nRecent journal entries (last 30 days, JSON — cite dates and moods when relevant):\n${JSON.stringify(content.journal)}`;
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

const INSIGHT_KINDS = [
  "schedule",
  "habits",
  "weak_areas",
  "weekly_plan",
  "celebrate",
  "productivity_patterns",
  "recurring_habits",
  "weekly_reflection",
  "goal_recs",
  "journal_insights",
] as const;
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
  productivity_patterns: `Analyze the user's recent notes, journal entries and stats and extract 3–5 productivity patterns (e.g. best days, energy dips, task categories that stall). For each pattern give a one-line insight and a one-line experiment to try this week.`,
  recurring_habits: `Scan the user's recent journal entries and notes for behaviors they mention repeatedly (good or bad). List 3–5 recurring habits as **Habit** — how often it shows up — whether it's helping or hurting — one suggested next step.`,
  weekly_reflection: `Write a warm, honest weekly reflection grounded in the user's journal entries, notes and stats. Structure it as four short paragraphs: What went well • What was hard • What you learned • What to try next week. Cite specific journal moments or note titles when possible.`,
  goal_recs: `Recommend 3 goals for the next 4 weeks tailored to this user's data, notes and journal. For each: **Goal** — why it fits (1 line grounded in their content) — first weekly milestone — how you'll know it's working.`,
  journal_insights: `Convert the user's recent journal entries into insights. Return 4–6 bullet points, each in the form: "Insight: <observation> → Action: <specific next step>". Reference dates or moods where relevant.`,
};

const ITEM_ACTIONS = ["summarize", "action_items", "improvements", "insights"] as const;
type ItemAction = (typeof ITEM_ACTIONS)[number];
const ITEM_ACTION_PROMPTS: Record<ItemAction, string> = {
  summarize: "Summarize this in 3–5 tight bullet points. Preserve names, numbers and decisions.",
  action_items: "Extract concrete action items as a checklist. Each item starts with a strong verb, is specific, and includes a suggested deadline when possible.",
  improvements: "Suggest 3–5 concrete improvements the user could make. Be specific and reference the content directly.",
  insights: "Convert this into 4–6 insights the user can act on. Format each as: \"Insight: <observation> → Action: <next step>\".",
};

export const analyzeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      source: z.enum(["note", "journal"]),
      id: z.string().uuid(),
      action: z.enum(ITEM_ACTIONS),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let title = "";
    let body = "";
    if (data.source === "note") {
      const { data: n, error } = await context.supabase
        .from("notes")
        .select("title, content, category, tags")
        .eq("id", data.id)
        .single();
      if (error || !n) return { ok: false as const, message: "Note not found." };
      title = (n as any).title || "Untitled note";
      body = `Category: ${(n as any).category}\nTags: ${((n as any).tags ?? []).join(", ")}\n\n${stripHtml((n as any).content ?? "")}`;
    } else {
      const { data: e, error } = await context.supabase
        .from("journal_entries")
        .select("entry_date, mood, energy_level, productivity_rating, tags, accomplishments, biggest_achievement, gratitude, lessons, challenges, improvements, reflections, body")
        .eq("id", data.id)
        .single();
      if (error || !e) return { ok: false as const, message: "Journal entry not found." };
      const je = e as any;
      title = `Journal — ${je.entry_date}`;
      body = [
        `Date: ${je.entry_date}`,
        `Mood: ${je.mood ?? "—"} • Energy: ${je.energy_level ?? "—"} • Productivity: ${je.productivity_rating ?? "—"}`,
        `Tags: ${(je.tags ?? []).join(", ")}`,
        je.accomplishments && `Accomplishments: ${je.accomplishments}`,
        je.biggest_achievement && `Biggest achievement: ${je.biggest_achievement}`,
        je.gratitude && `Gratitude: ${je.gratitude}`,
        je.lessons && `Lessons: ${je.lessons}`,
        je.challenges && `Challenges: ${je.challenges}`,
        je.improvements && `Improvements: ${je.improvements}`,
        je.reflections && `Reflections: ${je.reflections}`,
        stripHtml(je.body ?? ""),
      ].filter(Boolean).join("\n\n");
    }
    const capped = body.slice(0, 12000);
    const res = await callGateway([
      { role: "system", content: SYSTEM },
      { role: "user", content: `${ITEM_ACTION_PROMPTS[data.action]}\n\nTitle: ${title}\n\nContent:\n${capped}` },
    ]);
    return { ...res, title, action: data.action };
  });

export const generateCoachInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(INSIGHT_KINDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const days = data.kind === "weekly_plan" || data.kind === "celebrate" || data.kind === "weekly_reflection" ? 14 : 30;
    const usesContent = [
      "productivity_patterns",
      "recurring_habits",
      "weekly_reflection",
      "goal_recs",
      "journal_insights",
    ].includes(data.kind);
    const [stats, content] = await Promise.all([
      loadStats(context.supabase, days),
      usesContent ? loadContent(context.supabase, days) : Promise.resolve({ notes: [], journal: [] }),
    ]);
    const contentBlock = usesContent
      ? `\n\nRecent notes (JSON):\n${JSON.stringify(content.notes)}\n\nRecent journal entries (JSON):\n${JSON.stringify(content.journal)}`
      : "";
    const res = await callGateway([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `My last ${days} days as JSON:\n${JSON.stringify(stats)}${contentBlock}\n\n${INSIGHT_PROMPTS[data.kind]}`,
      },
    ]);
    return { ...res, kind: data.kind, stats };
  });
