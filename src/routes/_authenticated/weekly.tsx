import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, daysRange } from "@/lib/week";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { Trophy, TrendingUp, TrendingDown, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/weekly")({
  head: () => ({ meta: [{ title: "Weekly — DisciplineOS" }] }),
  component: Weekly,
});

function Weekly() {
  const weekStart = startOfWeek(new Date(), 1);
  const week = daysRange(weekStart, 7);

  const { data = { days: [], best: null, worst: null, missed: 0 } } = useQuery({
    queryKey: ["weekly", week[0]],
    queryFn: async () => {
      const [tasksRes, focusRes] = await Promise.all([
        supabase.from("tasks").select("scheduled_date, status").gte("scheduled_date", week[0]).lte("scheduled_date", week[6]),
        supabase.from("focus_sessions").select("session_date, duration_minutes").gte("session_date", week[0]).lte("session_date", week[6]),
      ]);
      const tasks = tasksRes.data ?? [];
      const focus = focusRes.data ?? [];
      const days = week.map((d) => {
        const ts = tasks.filter((t) => t.scheduled_date === d);
        const done = ts.filter((t) => t.status === "completed").length;
        const focusH = Math.round(focus.filter((f) => f.session_date === d).reduce((s, r) => s + r.duration_minutes, 0) / 60 * 10) / 10;
        return {
          day: new Date(d).toLocaleDateString(undefined, { weekday: "short" }),
          date: d,
          done,
          total: ts.length,
          completion: ts.length ? Math.round((done / ts.length) * 100) : 0,
          focus: focusH,
        };
      });
      const withTasks = days.filter((d) => d.total > 0);
      const best = withTasks.length ? withTasks.reduce((a, b) => (b.completion > a.completion ? b : a)) : null;
      const worst = withTasks.length ? withTasks.reduce((a, b) => (b.completion < a.completion ? b : a)) : null;
      const missed = tasks.filter((t) => t.status === "missed" || t.status === "late").length;
      return { days, best, worst, missed };
    },
  });

  const avgCompletion = data.days.length ? Math.round(data.days.reduce((s, d) => s + d.completion, 0) / data.days.length) : 0;
  const totalDone = data.days.reduce((s, d) => s + d.done, 0);
  const totalFocus = Math.round(data.days.reduce((s, d) => s + d.focus, 0) * 10) / 10;
  const avgFocus = data.days.length ? Math.round((totalFocus / data.days.length) * 10) / 10 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Weekly</h1>
        <p className="text-sm text-muted-foreground">Week of {new Date(week[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Avg completion" value={`${avgCompletion}%`} />
        <Stat label="Tasks done" value={`${totalDone}`} />
        <Stat label="Avg focus" value={`${avgFocus}h`} />
        <Stat label="Missed" value={`${data.missed}`} />
      </div>

      <Card title="Discipline trend">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.days}>
            <CartesianGrid stroke="oklch(0 0 0 / 0.06)" />
            <XAxis dataKey="day" stroke="currentColor" fontSize={11} />
            <YAxis stroke="currentColor" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
            <Line type="monotone" dataKey="completion" stroke="var(--color-emerald)" strokeWidth={2.5} dot={{ fill: "var(--color-emerald)", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Productivity (focus hours)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.days}>
            <CartesianGrid stroke="oklch(0 0 0 / 0.06)" />
            <XAxis dataKey="day" stroke="currentColor" fontSize={11} />
            <YAxis stroke="currentColor" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
            <Bar dataKey="focus" fill="var(--color-purple)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-emerald text-xs uppercase tracking-wider"><TrendingUp className="size-3.5" /> Best day</div>
          <div className="font-display text-xl font-bold mt-1">{data.best ? data.best.day : "—"}</div>
          <div className="text-xs text-muted-foreground">{data.best ? `${data.best.completion}% • ${data.best.done} done` : "No data"}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-orange text-xs uppercase tracking-wider"><TrendingDown className="size-3.5" /> Worst day</div>
          <div className="font-display text-xl font-bold mt-1">{data.worst ? data.worst.day : "—"}</div>
          <div className="text-xs text-muted-foreground">{data.worst ? `${data.worst.completion}% • ${data.worst.done} done` : "No data"}</div>
        </div>
      </div>

      <div className="glass rounded-3xl p-5 flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-emerald/15 grid place-items-center"><Trophy className="size-5 text-emerald" /></div>
        <div>
          <div className="font-display font-semibold">Weekly achievement</div>
          <div className="text-sm text-muted-foreground">
            {avgCompletion >= 80 ? "Crushed it — 80%+ completion." :
             avgCompletion >= 60 ? "Strong week. Push for 80% next." :
             avgCompletion >= 40 ? "Decent foundation. Tighten the schedule." :
             "Reset week — start with three small wins tomorrow."}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="font-display font-semibold text-sm mb-3 flex items-center gap-2"><Target className="size-4 text-emerald" /> {title}</h2>
      {children}
    </div>
  );
}