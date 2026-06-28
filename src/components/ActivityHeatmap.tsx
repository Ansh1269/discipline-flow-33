interface Props {
  /** Map of YYYY-MM-DD -> count (any positive activity for the day). */
  data: Record<string, number>;
  weeks?: number;
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ActivityHeatmap({ data, weeks = 12 }: Props) {
  const today = new Date();
  // Anchor to end of current week (Saturday) so the most recent column is "today's" week.
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  const start = new Date(endOfWeek);
  start.setDate(endOfWeek.getDate() - (weeks * 7 - 1));

  const cells: { date: string; count: number; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = iso(d);
    cells.push({ date: key, count: data[key] ?? 0, future: d > today });
  }

  // Bucketise counts: 0, 1, 2-3, 4-5, 6+
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  const shade = ["oklch(0.6 0.02 260 / 0.12)", "oklch(0.72 0.16 158 / 0.25)", "oklch(0.72 0.16 158 / 0.45)", "oklch(0.72 0.16 158 / 0.7)", "oklch(0.72 0.16 158 / 0.95)"];
  const dayLabels = ["Mon", "Wed", "Fri"];

  // Render as 7 rows (Sun..Sat) × `weeks` columns.
  const rows: typeof cells[] = Array.from({ length: 7 }, () => []);
  cells.forEach((c, i) => rows[i % 7].push(c));

  return (
    <div className="flex gap-2 items-start">
      <div className="flex flex-col justify-between text-[9px] text-muted-foreground py-0.5 h-[88px]">
        {dayLabels.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-rows-7 grid-flow-col gap-[3px]" role="img" aria-label={`Activity over the last ${weeks} weeks`}>
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date} · ${c.count} activit${c.count === 1 ? "y" : "ies"}`}
            className="size-[11px] rounded-[3px] transition-transform hover:scale-125"
            style={{ background: c.future ? "transparent" : shade[level(c.count)] }}
          />
        ))}
      </div>
    </div>
  );
}