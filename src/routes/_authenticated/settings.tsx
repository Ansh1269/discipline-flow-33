import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, FileJson, FileSpreadsheet, FileText, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { downloadCsv, downloadJson, downloadXlsx, downloadPdfReport } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DisciplineOS" }] }),
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const { data: settings } = useQuery({
    queryKey: ["settings", user.id],
    queryFn: async () => (await supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle()).data,
  });
  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });

  const [name, setName] = useState("");
  useEffect(() => { if (profile?.display_name) setName(profile.display_name); }, [profile?.display_name]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile", user.id] }); toast.success("Profile updated"); },
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: { notifications_enabled?: boolean; time_format?: string; week_start?: number; theme?: string; language?: string; reminder_sound?: string }) => {
      const { error } = await supabase.from("settings").update(patch as never).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", user.id] }),
  });

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function exportData(format: "csv" | "json") {
    const [tasks, habits, logs, focus, goals] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("habits").select("*"),
      supabase.from("habit_logs").select("*"),
      supabase.from("focus_sessions").select("*"),
      supabase.from("goals").select("*"),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      downloadJson(`disciplineos-export-${stamp}.json`, {
        exported_at: new Date().toISOString(),
        tasks: tasks.data ?? [], habits: habits.data ?? [], habit_logs: logs.data ?? [],
        focus_sessions: focus.data ?? [], goals: goals.data ?? [],
      });
    } else {
      downloadCsv(`disciplineos-tasks-${stamp}.csv`, (tasks.data ?? []) as never);
    }
    toast.success("Exported");
  }

  async function exportXlsx() {
    const [tasks, habits, logs, focus, goals] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("habits").select("*"),
      supabase.from("habit_logs").select("*"),
      supabase.from("focus_sessions").select("*"),
      supabase.from("goals").select("*"),
    ]);
    await downloadXlsx(`disciplineos-${new Date().toISOString().slice(0,10)}.xlsx`, {
      Tasks: (tasks.data ?? []) as never,
      Habits: (habits.data ?? []) as never,
      HabitLogs: (logs.data ?? []) as never,
      Focus: (focus.data ?? []) as never,
      Goals: (goals.data ?? []) as never,
    });
    toast.success("Excel ready");
  }

  async function exportPdf(range: "day" | "week" | "month" | "year") {
    const now = new Date();
    const start = new Date(now);
    if (range === "day") start.setHours(0,0,0,0);
    else if (range === "week") start.setDate(now.getDate() - 7);
    else if (range === "month") start.setMonth(now.getMonth() - 1);
    else start.setFullYear(now.getFullYear() - 1);
    const startISO = start.toISOString().slice(0, 10);
    const [{ data: tasks = [] }, { data: focus = [] }, { data: habits = [] }] = await Promise.all([
      supabase.from("tasks").select("title,category,status,scheduled_date,start_time,time_spent_minutes").gte("scheduled_date", startISO),
      supabase.from("focus_sessions").select("started_at,duration_minutes").gte("started_at", start.toISOString()),
      supabase.from("habits").select("name,current_streak,longest_streak"),
    ]);
    const tRows = (tasks ?? []).map((t) => [t.scheduled_date, t.start_time ?? "—", t.title, t.category, t.status, t.time_spent_minutes ?? 0]);
    const fMinutes = (focus ?? []).reduce((a, f) => a + (f.duration_minutes ?? 0), 0);
    const completed = (tasks ?? []).filter((t) => t.status === "completed").length;
    const total = (tasks ?? []).length;
    await downloadPdfReport(
      `disciplineos-${range}-report.pdf`,
      `DisciplineOS — ${range[0].toUpperCase()}${range.slice(1)}ly Report`,
      `${name || user.email} · Generated ${now.toLocaleString()}`,
      [
        { heading: "Summary", columns: ["Metric", "Value"], rows: [
          ["Tasks completed", `${completed} / ${total}`],
          ["Completion rate", total ? `${Math.round((completed / total) * 100)}%` : "—"],
          ["Focus minutes", String(fMinutes)],
          ["Active habits", String((habits ?? []).length)],
        ]},
        { heading: "Tasks", columns: ["Date","Time","Title","Category","Status","Min"], rows: tRows.slice(0, 200) },
        { heading: "Habits", columns: ["Habit","Current streak","Longest streak"], rows: (habits ?? []).map((h) => [h.name, h.current_streak ?? 0, h.longest_streak ?? 0]) },
      ],
    );
    toast.success("PDF ready");
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Make it yours.</p>
      </header>

      <Section title="Profile">
        <div className="space-y-3">
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={user.email ?? ""} disabled /></div>
          <Button onClick={() => saveProfile.mutate()} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Save</Button>
        </div>
      </Section>

      <Section title="Preferences">
        <div className="space-y-4">
          <Row label="Theme">
            <Button variant="outline" size="sm" onClick={toggle}>
              {theme === "dark" ? <><Sun className="size-4" /> Light</> : <><Moon className="size-4" /> Dark</>}
            </Button>
          </Row>
          <Row label="Notifications">
            <Switch checked={settings?.notifications_enabled ?? true} onCheckedChange={(v) => saveSettings.mutate({ notifications_enabled: v })} />
          </Row>
          <Row label="Time format">
            <Select value={settings?.time_format ?? "24h"} onValueChange={(v) => saveSettings.mutate({ time_format: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="24h">24-hour</SelectItem><SelectItem value="12h">12-hour</SelectItem></SelectContent>
            </Select>
          </Row>
          <Row label="Week starts">
            <Select value={String(settings?.week_start ?? 1)} onValueChange={(v) => saveSettings.mutate({ week_start: Number(v) })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="0">Sunday</SelectItem><SelectItem value="1">Monday</SelectItem></SelectContent>
            </Select>
          </Row>
          <Row label="Language">
            <Select value={settings?.language ?? "en"} onValueChange={(v) => saveSettings.mutate({ language: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Reminder sound">
            <Select value={settings?.reminder_sound ?? "chime"} onValueChange={(v) => saveSettings.mutate({ reminder_sound: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chime">Chime</SelectItem>
                <SelectItem value="bell">Bell</SelectItem>
                <SelectItem value="ping">Ping</SelectItem>
                <SelectItem value="none">Silent</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      </Section>

      <Section title="Backup & export">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Reports (PDF)</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportPdf("day")}><FileText className="size-4" /> Daily</Button>
              <Button variant="outline" size="sm" onClick={() => exportPdf("week")}><FileText className="size-4" /> Weekly</Button>
              <Button variant="outline" size="sm" onClick={() => exportPdf("month")}><FileText className="size-4" /> Monthly</Button>
              <Button variant="outline" size="sm" onClick={() => exportPdf("year")}><FileText className="size-4" /> Yearly</Button>
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Full backup</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportData("json")}><FileJson className="size-4" /> JSON</Button>
              <Button variant="outline" size="sm" onClick={() => exportData("csv")}><FileSpreadsheet className="size-4" /> CSV (tasks)</Button>
              <Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet className="size-4" /> Excel</Button>
            </div>
          </div>
        </div>
      </Section>

      <Button variant="outline" onClick={signOut} className="w-full bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/15">
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="font-display font-semibold text-sm mb-4">{title}</h2>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-sm">{label}</span>{children}</div>;
}