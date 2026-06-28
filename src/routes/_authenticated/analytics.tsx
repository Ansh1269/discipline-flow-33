import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — DisciplineOS" }] }),
  component: Analytics,
});

function lastNDays(n: number) {
  const arr: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}

function Analytics() {
  const days = lastNDays(14);
  const start = days[0];

  const { data: chart = [] } = useQuery({
    queryKey: ["analytics-14d"],
    queryFn: async () => {
      const { data: tasks } = await supabase.from("tasks").select("scheduled_date, status").gte("scheduled_date", start);
      const { data: focus } = await supabase.from("focus_sessions").select("session_date, duration_minutes").gte("session_date", start);
      return days.map((d) => {
        const ts = (tasks ?? []).filter((t) => t.scheduled_date === d);
        const done = ts.filter((t) => t.status === "completed").length;
        const total = ts.length;
        const focusMin = (focus ?? []).filter((f) => f.session_date === d).reduce((s, r) => s + r.duration_minutes, 0);
        return {
          day: d.slice(5),
          completion: total ? Math.round((done / total) * 100) : 0,
          focus: Math.round(focusMin / 60 * 10) / 10,
          done,
        };
      });
    },
  });

  const totals = chart.reduce((s, d) => ({ tasks: s.tasks + d.done, focus: s.focus + d.focus }), { tasks: 0, focus: 0 });
  const avgCompletion = chart.length ? Math.round(chart.reduce((s, d) => s + d.completion, 0) / chart.length) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Your last 14 days.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Avg completion" value={`${avgCompletion}%`} />
        <Stat label="Tasks done" value={`${totals.tasks}`} />
        <Stat label="Focus hours" value={`${totals.focus.toFixed(1)}h`} />
      </div>

      <Card title="Completion %">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <Tooltip contentStyle={{ background: "oklch(0.21 0.035 260)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Line type="monotone" dataKey="completion" stroke="var(--color-emerald)" strokeWidth={2.5} dot={{ fill: "var(--color-emerald)", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Focus hours">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <Tooltip contentStyle={{ background: "oklch(0.21 0.035 260)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Bar dataKey="focus" fill="var(--color-purple)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
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
      <h2 className="font-display font-semibold text-sm mb-3">{title}</h2>
      {children}
    </div>
  );
}