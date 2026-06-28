export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysRange(from: Date, count: number) {
  const arr: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    arr.push(isoDate(d));
  }
  return arr;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}
