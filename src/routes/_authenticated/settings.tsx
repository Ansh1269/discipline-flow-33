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
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DisciplineOS" }] }),
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

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