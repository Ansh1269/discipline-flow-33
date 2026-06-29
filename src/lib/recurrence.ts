export const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "weekends", label: "Weekends" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
  { value: "custom", label: "Custom weekdays" },
] as const;

export type RepeatType = "daily" | "weekdays" | "weekends" | "weekly" | "monthly" | "yearly" | "custom";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function addDaysISO(d: string, n: number): string {
  const dt = parseISO(d);
  dt.setDate(dt.getDate() + n);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function occursOn(
  rt: {
    repeat_type: string;
    repeat_days: number[] | null;
    starts_on: string;
    ends_on: string | null;
  },
  dateISO: string,
): boolean {
  if (dateISO < rt.starts_on) return false;
  if (rt.ends_on && dateISO > rt.ends_on) return false;
  const d = parseISO(dateISO);
  const dow = d.getDay();
  const start = parseISO(rt.starts_on);
  switch (rt.repeat_type as RepeatType) {
    case "daily": return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "weekends": return dow === 0 || dow === 6;
    case "weekly": return dow === start.getDay();
    case "monthly": return d.getDate() === start.getDate();
    case "yearly": return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
    case "custom": return (rt.repeat_days ?? []).includes(dow);
    default: return false;
  }
}

export function describeRepeat(rt: { repeat_type: string; repeat_days: number[] | null }): string {
  switch (rt.repeat_type as RepeatType) {
    case "daily": return "Every day";
    case "weekdays": return "Weekdays";
    case "weekends": return "Weekends";
    case "weekly": return "Every week";
    case "monthly": return "Every month";
    case "yearly": return "Every year";
    case "custom":
      return `Custom (${(rt.repeat_days ?? []).map((d) => WEEKDAY_LABELS[d]).join(", ") || "—"})`;
    default: return "Does not repeat";
  }
}