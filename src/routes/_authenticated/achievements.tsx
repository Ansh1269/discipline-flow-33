import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Star, Award, Zap, Target, Crown, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "Achievements — DisciplineOS" }] }),
  component: Achievements,
});

const BADGES = [
  { code: "first_task", title: "First Step", desc: "Complete your first task", icon: Star, check: (s: Stats) => s.totalDone >= 1 },
  { code: "ten_tasks", title: "Builder", desc: "Complete 10 tasks", icon: Target, check: (s: Stats) => s.totalDone >= 10 },
  { code: "hundred_tasks", title: "Centurion", desc: "Complete 100 tasks", icon: Award, check: (s: Stats) => s.totalDone >= 100 },
  { code: "streak_3", title: "Spark", desc: "3-day streak", icon: Flame, check: (s: Stats) => s.streak >= 3 },
  { code: "streak_7", title: "On Fire", desc: "7-day streak", icon: Flame, check: (s: Stats) => s.streak >= 7 },
  { code: "streak_30", title: "Unbreakable", desc: "30-day streak", icon: Crown, check: (s: Stats) => s.streak >= 30 },
  { code: "deep_10h", title: "Deep Diver", desc: "10h of deep work", icon: Zap, check: (s: Stats) => s.focusH >= 10 },
  { code: "deep_50h", title: "Flow State", desc: "50h of focus", icon: Sparkles, check: (s: Stats) => s.focusH >= 50 },
  { code: "habit_master", title: "Habit Master", desc: "3+ active habits", icon: Trophy, check: (s: Stats) => s.habitCount >= 3 },
];

type Stats = { totalDone: number; streak: number; focusH: number; habitCount: number; xp: number; level: number };

function Achievements() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ["achievement-stats"],
    queryFn: async () => {
      const [tasksRes, focusRes, profileRes, habitsRes] = await Promise.all([
        supabase.from("tasks").select("status", { count: "exact", head: false }).eq("status", "completed"),
        supabase.from("focus_sessions").select("duration_minutes"),
        supabase.from("profiles").select("current_streak, xp, level").maybeSingle(),
        supabase.from("habits").select("id", { count: "exact", head: true }).eq("archived", false),
      ]);
      return {
        totalDone: tasksRes.data?.length ?? 0,
        streak: profileRes.data?.current_streak ?? 0,
        focusH: Math.round((focusRes.data ?? []).reduce((s, r) => s + r.duration_minutes, 0) / 60 * 10) / 10,
        habitCount: habitsRes.count ?? 0,
        xp: profileRes.data?.xp ?? 0,
        level: profileRes.data?.level ?? 1,
      };
    },
  });

  const unlocked = stats ? BADGES.filter((b) => b.check(stats)) : [];
  const locked = stats ? BADGES.filter((b) => !b.check(stats)) : [];
  const xpForNext = (stats?.level ?? 1) * 500;
  const xpProgress = stats ? Math.min(100, Math.round((stats.xp / xpForNext) * 100)) : 0;

  const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];
  const streak = stats?.streak ?? 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) ?? streak;
  const prevMilestone = [...STREAK_MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const streakPct = nextMilestone > prevMilestone
    ? Math.min(100, Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
    : 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Achievements</h1>
        <p className="text-sm text-muted-foreground">{unlocked.length}/{BADGES.length} unlocked.</p>
      </header>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald to-purple grid place-items-center text-2xl font-display font-bold text-white shrink-0">
            {stats?.level ?? 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg font-bold">Level {stats?.level ?? 1}</div>
            <div className="text-xs text-muted-foreground">{stats?.xp ?? 0} / {xpForNext} XP</div>
            <div className="mt-2 h-2 bg-accent/20 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald to-purple transition-all" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="size-3.5 text-orange" /> Current streak</div>
          <div className="font-display text-3xl font-bold mt-1">{streak}<span className="text-sm text-muted-foreground font-normal ml-1">days</span></div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{prevMilestone}d</span><span>{nextMilestone}d</span>
          </div>
          <div className="h-2 bg-accent/20 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-gradient-to-r from-orange to-red transition-all" style={{ width: `${streakPct}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">{nextMilestone - streak > 0 ? `${nextMilestone - streak} day${nextMilestone - streak === 1 ? "" : "s"} to next milestone` : "Max milestone reached"}</div>
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="size-3.5 text-emerald" /> Tasks completed</div>
          <div className="font-display text-3xl font-bold mt-1">{stats?.totalDone ?? 0}</div>
          <div className="text-[11px] text-muted-foreground mt-2">Lifetime</div>
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="size-3.5 text-purple" /> Focus hours</div>
          <div className="font-display text-3xl font-bold mt-1">{stats?.focusH ?? 0}<span className="text-sm text-muted-foreground font-normal ml-1">h</span></div>
          <div className="text-[11px] text-muted-foreground mt-2">Lifetime focused work</div>
        </div>
      </div>

      {unlocked.length > 0 && (
        <section>
          <h2 className="font-display font-semibold text-sm mb-3">Unlocked</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {unlocked.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.code} className="glass rounded-2xl p-4 text-center">
                  <div className="size-12 mx-auto rounded-2xl bg-emerald/15 grid place-items-center"><Icon className="size-5 text-emerald" /></div>
                  <div className="font-display font-bold text-sm mt-2">{b.title}</div>
                  <div className="text-[10px] text-muted-foreground">{b.desc}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-semibold text-sm mb-3">Locked</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {locked.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.code} className="glass-soft rounded-2xl p-4 text-center opacity-50">
                <div className="size-12 mx-auto rounded-2xl bg-accent/10 grid place-items-center"><Icon className="size-5 text-muted-foreground" /></div>
                <div className="font-display font-bold text-sm mt-2">{b.title}</div>
                <div className="text-[10px] text-muted-foreground">{b.desc}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}