import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Trophy, Zap, Target, Settings as SettingsIcon, Sparkles, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — DisciplineOS" }] }),
  component: ProfilePage,
});

type ProfileData = {
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    xp: number;
    level: number;
    current_streak: number;
    longest_streak: number;
    created_at: string;
  } | null;
  email: string | null;
  totalDone: number;
  focusH: number;
  habitCount: number;
  goalCount: number;
};

function ProfilePage() {
  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile-page"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const [profileRes, tasksRes, focusRes, habitsRes, goalsRes] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, bio, xp, level, current_streak, longest_streak, created_at").eq("id", uid!).maybeSingle(),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("focus_sessions").select("duration_minutes"),
        supabase.from("habits").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("goals").select("id", { count: "exact", head: true }),
      ]);
      return {
        profile: profileRes.data,
        email: userRes.user?.email ?? null,
        totalDone: tasksRes.count ?? 0,
        focusH: Math.round((focusRes.data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / 60 * 10) / 10,
        habitCount: habitsRes.count ?? 0,
        goalCount: goalsRes.count ?? 0,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 glass rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 glass rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const p = data.profile;
  const initials = (p?.display_name ?? data.email ?? "U").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const xpForNext = (p?.level ?? 1) * 500;
  const xpPct = p ? Math.min(100, Math.round((p.xp / xpForNext) * 100)) : 0;
  const memberSince = p?.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "—";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your discipline journey at a glance.</p>
        </div>
        <Link
          to="/settings"
          className="glass rounded-xl px-3 py-2 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-accent/10 transition-colors"
        >
          <SettingsIcon className="size-3.5" /> Edit
        </Link>
      </header>

      <section className="glass rounded-3xl p-6">
        <div className="flex items-center gap-4">
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt="" className="size-20 rounded-2xl object-cover shrink-0 ring-2 ring-emerald/30" />
          ) : (
            <div className="size-20 rounded-2xl bg-gradient-to-br from-emerald to-purple grid place-items-center text-2xl font-display font-bold text-white shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl font-bold truncate">{p?.display_name ?? "Unnamed"}</div>
            {data.email && <div className="text-xs text-muted-foreground truncate">{data.email}</div>}
            <div className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="size-3" /> Member since {memberSince}
            </div>
          </div>
        </div>

        {p?.bio && (
          <p className="mt-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{p.bio}</p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald/15 grid place-items-center font-display font-bold text-emerald shrink-0">
            {p?.level ?? 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Level {p?.level ?? 1}</span>
              <span>{p?.xp ?? 0} / {xpForNext} XP</span>
            </div>
            <div className="mt-1 h-2 bg-accent/20 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald to-purple transition-all" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Flame} tone="text-orange" label="Current streak" value={`${p?.current_streak ?? 0}d`} />
        <Stat icon={Trophy} tone="text-emerald" label="Longest streak" value={`${p?.longest_streak ?? 0}d`} />
        <Stat icon={Target} tone="text-purple" label="Tasks done" value={data.totalDone} />
        <Stat icon={Zap} tone="text-orange" label="Focus hours" value={`${data.focusH}h`} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link to="/habits" className="glass rounded-2xl p-4 hover:bg-accent/5 transition-colors">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Flame className="size-3.5 text-emerald" /> Active habits</div>
          <div className="font-display text-2xl font-bold mt-1">{data.habitCount}</div>
        </Link>
        <Link to="/goals" className="glass rounded-2xl p-4 hover:bg-accent/5 transition-colors">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Target className="size-3.5 text-purple" /> Goals</div>
          <div className="font-display text-2xl font-bold mt-1">{data.goalCount}</div>
        </Link>
      </section>

      <Link to="/achievements" className="glass rounded-3xl p-5 flex items-center gap-4 hover:bg-accent/5 transition-colors">
        <div className="size-12 rounded-2xl bg-gradient-to-br from-orange to-red grid place-items-center">
          <Sparkles className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm">View achievements</div>
          <div className="text-xs text-muted-foreground">Badges, XP milestones, and streak rewards.</div>
        </div>
        <span className="text-muted-foreground text-sm">→</span>
      </Link>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value }: { icon: typeof Flame; tone: string; label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={`size-3.5 ${tone}`} /> {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}