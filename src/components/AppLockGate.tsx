import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fingerprint, Lock, Delete } from "lucide-react";
import { toast } from "sonner";
import {
  getConfig, isUnlocked, markUnlocked, markLocked,
  verifySecret, verifyBiometric, biometricsSupported, type LockConfig,
} from "@/lib/appLock";

export function AppLockGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [cfg, setCfg] = useState<LockConfig | null>(() => getConfig(userId));
  const [locked, setLocked] = useState(() => {
    const c = getConfig(userId);
    return !!c?.enabled && !isUnlocked(userId);
  });
  const [blur, setBlur] = useState(false);
  const hideAt = useRef<number | null>(null);

  // Watch for config changes (from Security page)
  useEffect(() => {
    const sync = () => {
      const c = getConfig(userId);
      setCfg(c);
      if (c?.enabled && !isUnlocked(userId)) setLocked(true);
      if (!c?.enabled) setLocked(false);
    };
    window.addEventListener("applock:changed", sync);
    window.addEventListener("applock:locked", sync);
    return () => {
      window.removeEventListener("applock:changed", sync);
      window.removeEventListener("applock:locked", sync);
    };
  }, [userId]);

  // Auto-lock: on tab hidden, start timer; on visible, check elapsed
  useEffect(() => {
    if (!cfg?.enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hideAt.current = Date.now();
        if (cfg.privacyBlur) setBlur(true);
      } else {
        setBlur(false);
        const gone = hideAt.current ? Date.now() - hideAt.current : 0;
        hideAt.current = null;
        if (gone >= cfg.autoLockMs) {
          markLocked(userId);
          setLocked(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [cfg, userId]);

  // Inactivity lock while visible
  useEffect(() => {
    if (!cfg?.enabled || locked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      if (cfg.autoLockMs === 0) return;
      timer = setTimeout(() => {
        markLocked(userId);
        setLocked(true);
      }, cfg.autoLockMs);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [cfg, locked, userId]);

  if (!cfg?.enabled) return <>{children}</>;

  return (
    <>
      <div className={blur && !locked ? "blur-lg pointer-events-none select-none transition" : "transition"}>
        {children}
      </div>
      {locked && (
        <LockScreen
          cfg={cfg}
          onUnlock={() => {
            markUnlocked(userId);
            setLocked(false);
          }}
        />
      )}
    </>
  );
}

function LockScreen({ cfg, onUnlock }: { cfg: LockConfig; onUnlock: () => void }) {
  const isPin = cfg.method !== "password";
  const len = cfg.method === "pin4" ? 4 : cfg.method === "pin6" ? 6 : 0;
  const [value, setValue] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const canBio = cfg.biometricsEnabled && biometricsSupported();
  const forcePassword = failCount >= 3;

  useEffect(() => {
    // Prompt biometrics automatically once
    if (canBio && !forcePassword) {
      void tryBio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryBio() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await verifyBiometric(cfg);
      if (ok) onUnlock();
    } catch { /* user cancelled */ }
    finally { setBusy(false); }
  }

  async function submit(v: string) {
    if (busy || !v) return;
    setBusy(true);
    const ok = await verifySecret(cfg, v);
    setBusy(false);
    if (ok) { setFailCount(0); onUnlock(); return; }
    setFailCount((n) => n + 1);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setValue("");
    toast.error("Incorrect");
  }

  function pressKey(k: string) {
    if (k === "back") { setValue((v) => v.slice(0, -1)); return; }
    setValue((v) => {
      const next = (v + k).slice(0, len);
      if (next.length === len) void submit(next);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-background/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className={`w-full max-w-sm px-6 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-16 rounded-2xl bg-emerald/15 grid place-items-center mb-3 soft-shadow">
            <Lock className="size-7 text-emerald" />
          </div>
          <h1 className="font-display text-2xl font-bold">DisciplineOS is locked</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isPin && !forcePassword ? `Enter your ${len}-digit PIN` : "Enter your password"}
          </p>
        </div>

        {isPin && !forcePassword ? (
          <PinInput length={len} value={value} onKey={pressKey} />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit(value); }} className="space-y-3">
            <Input autoFocus type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Password" autoComplete="current-password" />
            <Button type="submit" className="w-full bg-emerald hover:bg-emerald/90 text-emerald-foreground" disabled={busy}>Unlock</Button>
          </form>
        )}

        {canBio && !forcePassword && (
          <Button variant="outline" onClick={tryBio} disabled={busy} className="w-full mt-4">
            <Fingerprint className="size-4" /> Use biometrics
          </Button>
        )}
        {forcePassword && (
          <p className="text-xs text-center text-destructive mt-4">
            Too many failed attempts. Biometrics disabled — enter your password.
          </p>
        )}
      </div>
    </div>
  );
}

function PinInput({ length, value, onKey }: { length: number; value: string; onKey: (k: string) => void }) {
  const dots = useMemo(() => Array.from({ length }, (_, i) => i < value.length), [length, value]);
  return (
    <div>
      <div className="flex justify-center gap-3 mb-6" aria-live="polite">
        {dots.map((filled, i) => (
          <div key={i} className={`size-3.5 rounded-full transition-all ${filled ? "bg-emerald scale-110" : "bg-muted-foreground/30"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((k) => (
          <button key={k} onClick={() => onKey(k)} className="glass rounded-2xl h-14 text-xl font-display font-semibold hover:bg-emerald/10 active:scale-95 transition">{k}</button>
        ))}
        <div />
        <button onClick={() => onKey("0")} className="glass rounded-2xl h-14 text-xl font-display font-semibold hover:bg-emerald/10 active:scale-95 transition">0</button>
        <button onClick={() => onKey("back")} aria-label="Backspace" className="glass rounded-2xl h-14 grid place-items-center hover:bg-emerald/10 active:scale-95 transition">
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  );
}