import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface WeeklyPoint { label: string; date: string; pct: number; done: number; total: number }

export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const max = Math.max(100, ...data.map((d) => d.pct));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
          <YAxis domain={[0, max]} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} width={28} />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.25 }}
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
              padding: "6px 10px",
            }}
            labelStyle={{ color: "var(--color-muted-foreground)" }}
            formatter={(_, __, item) => {
              const p = item?.payload as WeeklyPoint | undefined;
              return [p ? `${p.done}/${p.total} · ${p.pct}%` : "—", "Done"];
            }}
          />
          <Bar dataKey="pct" radius={[8, 8, 4, 4]} animationDuration={700}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pct >= 80 ? "var(--color-emerald)" : d.pct >= 40 ? "var(--color-orange)" : "var(--color-muted)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}