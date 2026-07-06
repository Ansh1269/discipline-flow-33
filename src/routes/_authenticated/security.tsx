import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Fingerprint, Lock, EyeOff, KeyRound } from "lucide-react";
import {
  getConfig, saveConfig, clearConfig, createLock, changeSecret, verifySecret,
  enrollBiometric, disableBiometric, biometricsSupported, markLocked,
  AUTO_LOCK_OPTIONS, autoLockLabel, type LockConfig, type AutoLockMs,
} from "@/lib/appLock";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Security — DisciplineOS" }] }),
  component: SecurityPage,
});

type Method = "pin4" | "pin6" | "password";

function SecurityPage() {
  const { user } = Route.useRouteContext();
  const [cfg, setCfg] = useState<LockConfig | null>(() => getConfig(user.id));
  const bioAvail = biometricsSupported();

  useEffect(() => {
    const sync = () => setCfg(getConfig(user.id));
    window.addEventListener("applock:changed", sync);
    return () => window.removeEventListener("applock:changed", sync);
  }, [user.id]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-2xl bg-emerald/15 grid place-items-center"><Shield className="size-5 text-emerald" /></div>
        <div>
          <h1 className="font-display text-3xl font-bold">Security</h1>
          <p className="text-sm text-muted-foreground">Lock the app and hide your data when you step away.</p>
        </div>
      </header>

      <Section title="App Lock" icon={Lock}>
        {!cfg?.enabled ? (
          <EnableForm userId={user.id} onEnabled={setCfg} />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Active — {cfg.method === "password" ? "password" : `${cfg.method === "pin4" ? 4 : 6}-digit PIN`}</p>
            <ChangeForm userId={user.id} cfg={cfg} onUpdated={setCfg} />
            <Row label="Auto-lock">
              <Select value={String(cfg.autoLockMs)} onValueChange={(v) => { const next = { ...cfg, autoLockMs: Number(v) as AutoLockMs }; saveConfig(user.id, next); setCfg(next); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{AUTO_LOCK_OPTIONS.map((ms) => <SelectItem key={ms} value={String(ms)}>{autoLockLabel(ms)}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
            <Button variant="outline" size="sm" onClick={() => { markLocked(user.id); }}>Lock now</Button>
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Turn off App Lock on this device?")) { clearConfig(user.id); setCfg(null); toast.success("App Lock disabled"); } }} className="ml-2 text-destructive border-destructive/30 hover:bg-destructive/10">Disable App Lock</Button>
          </div>
        )}
      </Section>

      <Section title="Biometrics" icon={Fingerprint}>
        {!bioAvail && <p className="text-xs text-muted-foreground">This device or browser doesn't support biometric authentication.</p>}
        {bioAvail && !cfg?.enabled && <p className="text-xs text-muted-foreground">Enable App Lock first to add biometrics.</p>}
        {bioAvail && cfg?.enabled && (
          <div className="space-y-3">
            <Row label="Fingerprint / Face unlock">
              <Switch
                checked={cfg.biometricsEnabled}
                onCheckedChange={async (v) => {
                  try {
                    if (v) { const next = await enrollBiometric(user.id, cfg); setCfg(next); toast.success("Biometrics enabled"); }
                    else { const next = disableBiometric(user.id, cfg); setCfg(next); toast.success("Biometrics disabled"); }
                  } catch { toast.error("Couldn't set up biometrics"); }
                }}
              />
            </Row>
            <p className="text-xs text-muted-foreground">You'll be prompted for biometrics when unlocking. After 3 failed attempts you'll need your password.</p>
          </div>
        )}
      </Section>

      <Section title="Privacy Mode" icon={EyeOff}>
        {!cfg?.enabled ? (
          <p className="text-xs text-muted-foreground">Enable App Lock first.</p>
        ) : (
          <Row label="Blur screen when app is in background">
            <Switch checked={cfg.privacyBlur} onCheckedChange={(v) => { const next = { ...cfg, privacyBlur: v }; saveConfig(user.id, next); setCfg(next); }} />
          </Row>
        )}
      </Section>

      <div className="glass rounded-3xl p-5">
        <p className="text-xs text-muted-foreground">
          App Lock is stored on this device only. To manage your account, password, and sign out of all devices, go to <Link to="/settings" className="text-emerald hover:underline">Settings</Link>.
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Shield; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><Icon className="size-4 text-emerald" /> {title}</h2>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm">{label}</span>{children}</div>;
}

function EnableForm({ userId, onEnabled }: { userId: string; onEnabled: (c: LockConfig) => void }) {
  const [method, setMethod] = useState<Method>("pin4");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [autoLock, setAutoLock] = useState<AutoLockMs>(60_000);
  const [busy, setBusy] = useState(false);

  const targetLen = method === "pin4" ? 4 : method === "pin6" ? 6 : 8;
  const isPin = method !== "password";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isPin && !/^\d+$/.test(secret)) { toast.error("PIN must be digits only"); return; }
    if (secret.length < targetLen) { toast.error(isPin ? `PIN must be ${targetLen} digits` : "Password must be at least 8 characters"); return; }
    if (secret !== confirm) { toast.error("Doesn't match"); return; }
    setBusy(true);
    const cfg = await createLock(userId, method, secret, autoLock);
    setBusy(false);
    onEnabled(cfg);
    toast.success("App Lock enabled");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Row label="Method">
        <Select value={method} onValueChange={(v) => { setMethod(v as Method); setSecret(""); setConfirm(""); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pin4">4-digit PIN</SelectItem>
            <SelectItem value="pin6">6-digit PIN</SelectItem>
            <SelectItem value="password">Password</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <div>
        <Label htmlFor="sec">{isPin ? "New PIN" : "New password"}</Label>
        <Input id="sec" type={isPin ? "password" : "password"} inputMode={isPin ? "numeric" : undefined} value={secret} onChange={(e) => setSecret(isPin ? e.target.value.replace(/\D/g, "").slice(0, targetLen) : e.target.value)} autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="sec2">Confirm</Label>
        <Input id="sec2" type="password" inputMode={isPin ? "numeric" : undefined} value={confirm} onChange={(e) => setConfirm(isPin ? e.target.value.replace(/\D/g, "").slice(0, targetLen) : e.target.value)} autoComplete="new-password" />
      </div>
      <Row label="Auto-lock">
        <Select value={String(autoLock)} onValueChange={(v) => setAutoLock(Number(v) as AutoLockMs)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{AUTO_LOCK_OPTIONS.map((ms) => <SelectItem key={ms} value={String(ms)}>{autoLockLabel(ms)}</SelectItem>)}</SelectContent>
        </Select>
      </Row>
      <Button type="submit" disabled={busy} className="w-full bg-emerald hover:bg-emerald/90 text-emerald-foreground"><Lock className="size-4" /> Enable App Lock</Button>
    </form>
  );
}

function ChangeForm({ userId, cfg, onUpdated }: { userId: string; cfg: LockConfig; onUpdated: (c: LockConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [method, setMethod] = useState<Method>(cfg.method);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const isPin = method !== "password";
  const targetLen = method === "pin4" ? 4 : method === "pin6" ? 6 : 8;

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><KeyRound className="size-4" /> Change PIN / password</Button>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await verifySecret(cfg, current);
    if (!ok) { setBusy(false); toast.error("Current PIN/password incorrect"); return; }
    if (isPin && !/^\d+$/.test(next)) { setBusy(false); toast.error("PIN must be digits only"); return; }
    if (next.length < targetLen) { setBusy(false); toast.error(isPin ? `PIN must be ${targetLen} digits` : "Password must be at least 8 characters"); return; }
    if (next !== confirm) { setBusy(false); toast.error("Doesn't match"); return; }
    const updated = await changeSecret(userId, cfg, method, next);
    setBusy(false);
    onUpdated(updated);
    setOpen(false); setCurrent(""); setNext(""); setConfirm("");
    toast.success("Updated");
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border p-3">
      <div><Label>Current</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>
      <Row label="New method">
        <Select value={method} onValueChange={(v) => { setMethod(v as Method); setNext(""); setConfirm(""); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pin4">4-digit PIN</SelectItem>
            <SelectItem value="pin6">6-digit PIN</SelectItem>
            <SelectItem value="password">Password</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <div><Label>New</Label><Input type="password" inputMode={isPin ? "numeric" : undefined} value={next} onChange={(e) => setNext(isPin ? e.target.value.replace(/\D/g, "").slice(0, targetLen) : e.target.value)} autoComplete="new-password" /></div>
      <div><Label>Confirm new</Label><Input type="password" inputMode={isPin ? "numeric" : undefined} value={confirm} onChange={(e) => setConfirm(isPin ? e.target.value.replace(/\D/g, "").slice(0, targetLen) : e.target.value)} autoComplete="new-password" /></div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Save</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}