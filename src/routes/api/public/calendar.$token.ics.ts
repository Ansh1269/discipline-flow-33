import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function fold(line: string): string {
  // RFC5545: lines >75 octets get folded with CRLF + space
  const out: string[] = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = " " + s.slice(73); }
  out.push(s);
  return out.join("\r\n");
}
function esc(s: string) {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function fmt(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export const Route = createFileRoute("/api/public/calendar/$token/ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token?.replace(/\.ics$/i, "");
        if (!token || !/^[a-f0-9]{20,80}$/i.test(token)) return new Response("Not found", { status: 404 });

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: profile } = await admin.from("profiles").select("id,display_name").eq("ics_token", token).maybeSingle();
        if (!profile) return new Response("Not found", { status: 404 });

        const since = new Date(); since.setDate(since.getDate() - 60);
        const { data: tasks = [] } = await admin
          .from("tasks")
          .select("id,title,notes,category,scheduled_date,start_time,end_time,updated_at")
          .eq("user_id", profile.id)
          .gte("scheduled_date", since.toISOString().slice(0, 10))
          .limit(2000);

        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//DisciplineOS//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          fold(`X-WR-CALNAME:DisciplineOS — ${esc(profile.display_name ?? "Schedule")}`),
        ];
        for (const t of tasks ?? []) {
          if (!t.scheduled_date) continue;
          const date = t.scheduled_date as string;
          const start = (t.start_time as string | null) ?? "09:00:00";
          const end = (t.end_time as string | null) ?? start;
          const startDt = new Date(`${date}T${start.length === 5 ? start + ":00" : start}`);
          const endDt = new Date(`${date}T${end.length === 5 ? end + ":00" : end}`);
          if (endDt <= startDt) endDt.setMinutes(endDt.getMinutes() + 30);
          lines.push(
            "BEGIN:VEVENT",
            `UID:${t.id}@disciplineos`,
            `DTSTAMP:${fmt(new Date((t.updated_at as string) ?? Date.now()))}`,
            `DTSTART:${fmt(startDt)}`,
            `DTEND:${fmt(endDt)}`,
            fold(`SUMMARY:${esc(t.title as string)}`),
            fold(`CATEGORIES:${esc((t.category as string) ?? "")}`),
            fold(`DESCRIPTION:${esc(((t.notes as string) ?? "").replace(/<[^>]+>/g, ""))}`),
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");
        const body = lines.join("\r\n") + "\r\n";
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});