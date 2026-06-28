import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Trophy, Flame, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/yearly")({
  head: () => ({ meta: [{ title: "Yearly — DisciplineOS" }] }),
  component: Yearly,
});

function Yearly() {
  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data = { months: [], totals: { tasks: 0, focus: 0 }, longest: 0, habitTotals: [] } } = useQuery({
    queryKey: ["yearly", year],
    queryFn: async () => {
      const [tasksRes, focusRes, profileRes, habitsRes] = await Promise.all([
        supabase.from("tasks").select("scheduled_date, status").gte("scheduled_date", start).lte("scheduled_date", end),
        supabase.from("focus_sessions").select("session_date, duration_minutes").gte("session_date", start).lte("session_date", end),
        supabase.from("profiles").select("longest_streak, current_streak").maybeSingle(),
        supabase.from("habits").select("name, current_streak, longest_streak").eq("archived", false),
      ]);
      const tasks = tasksRes.data ?? [];
      const focus = focusRes.data ?? [];
      const months = Array.from({ length: 12 }, (_, m) => {
        const ts = tasks.filter((t) => new Date(t.scheduled_date).getMonth() === m);
        const done = ts.filter((t) => t.status === "completed").length;
        const f = focus.filter((x) => new Date(x.session_date).getMonth() === m).reduce((s, r) => s + r.duration_minutes, 0);
        return {
          month: new Date(year, m, 1).toLocaleDateString(undefined, { month: "short" }),
          tasks: done,
          completion: ts.length ? Math.round((done / ts.length) * 100) : 0,
          focus: Math.round(f / 60),
        };
      });
      return {
        months,
        totals: {
          tasks: tasks.filter((t) => t.status === "completed").length,
          focus: Math.round(focus.reduce((s, r) => s + r.duration_minutes, 0) / 60),
        },
        longest: profileRes.data?.longest_streak ?? 0,
        habitTotals: habitsRes.data ?? [],
      };
    },
  });

  const avgDiscipline = data.months.filter((m) => m.completion > 0).length
    ? Math.round(data.months.reduce((s, m) => s + m.completion, 0) / data.months.filter((m) => m.completion > 0).length)
    : 0;
  const consistency = Math.round((data.months.filter((m) => m.tasks > 0).length / 12) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Year in review · {year}</h1>
        <p className="text-sm text-muted-foreground">Your journey, condensed.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Target} label="Total tasks" value={`${data.totals.tasks}`} />
        <Stat icon={Trophy} label="Focus hours" value={`${data.totals.focus}h`} />
        <Stat icon={Flame} label="Longest streak" value={`${data.longest}`} />
        <Stat icon={Target} label="Consistency" value={`${consistency}%`} />
      </div>

      <Card title="Tasks completed per month">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.months}>
            <CartesianGrid stroke="oklch(0 0 0 / 0.06)" />
            <XAxis dataKey="month" stroke="currentColor" fontSize={11} />
            <YAxis stroke="currentColor" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
            <Bar dataKey="tasks" fill="var(--color-emerald)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Focus hours per month">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.months}>
            <CartesianGrid stroke="oklch(0 0 0 / 0.06)" />
            <XAxis dataKey="month" stroke="currentColor" fontSize={11} />
            <YAxis stroke="currentColor" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
            <Bar dataKey="focus" fill="var(--color-purple)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="glass rounded-3xl p-5">
        <h2 className="font-display font-semibold text-sm mb-3">Habit growth</h2>
        {data.habitTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No habits yet.</p>
        ) : (
          <div className="space-y-2">
            {data.habitTotals.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium">{h.name}</span>
                <span className="text-muted-foreground">🔥 {h.current_streak} · best {h.longest_streak}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-6 text-center">
        <Trophy className="size-8 text-emerald mx-auto" />
        <div className="font-display text-2xl font-bold mt-3">Avg discipline {avgDiscipline}%</div>
        <p className="text-sm text-muted-foreground mt-1">{year} keeps building. Show up tomorrow.</p>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <Icon className="size-4 text-emerald" />
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="font-display font-semibold text-sm mb-3">{title}</h2>
      {children}
    </div>
  );
}