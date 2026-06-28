import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Reminder = {
  id: string;
  title: string;
  kind: string;
  remind_at: string;
  recurrence: string;
  enabled: boolean;
  last_fired_at: string | null;
};

function nextOccurrence(from: Date, recurrence: string): Date | null {
  const d = new Date(from);
  switch (recurrence) {
    case "hourly": d.setHours(d.getHours() + 1); return d;
    case "daily": d.setDate(d.getDate() + 1); return d;
    case "weekly": d.setDate(d.getDate() + 7); return d;
    default: return null;
  }
}

async function fire(r: Reminder) {
  const body = new Date(r.remind_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(r.title || "Reminder", {
        body,
        tag: `rem-${r.id}`,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: "/reminders" },
      });
    } else if ("Notification" in window) {
      new Notification(r.title || "Reminder", { body, tag: `rem-${r.id}` });
    }
  } catch { /* ignore */ }
}

async function tick() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("reminders" as never)
    .select("*")
    .eq("enabled", true)
    .lte("remind_at", nowIso)
    .limit(20);
  const due = (data ?? []) as unknown as Reminder[];
  for (const r of due) {
    if (r.last_fired_at && new Date(r.last_fired_at) >= new Date(r.remind_at)) continue;
    await fire(r);
    const firedAt = new Date().toISOString();
    const next = nextOccurrence(new Date(r.remind_at), r.recurrence);
    const patch: Record<string, unknown> = { last_fired_at: firedAt };
    if (next) patch.remind_at = next.toISOString();
    else patch.enabled = false;
    await supabase.from("reminders" as never).update(patch as never).eq("id", r.id);
  }
}

export function useReminderScheduler() {
  useEffect(() => {
    let cancelled = false;
    void tick();
    const id = setInterval(() => { if (!cancelled) void tick(); }, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}

export async function enablePushNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const perm = await Notification.requestPermission();
  return perm === "granted" ? "granted" : "denied";
}