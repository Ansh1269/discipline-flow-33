// Client-side App Lock + Privacy Mode. Per-user, per-device (localStorage).
// PIN/password hashed with PBKDF2-SHA256 (200k iters, random salt).
// WebAuthn platform authenticator for biometrics. No secrets ever leave the device.

type Method = "pin4" | "pin6" | "password";
export type AutoLockMs = 0 | 30_000 | 60_000 | 5 * 60_000 | 15 * 60_000;

export interface LockConfig {
  enabled: boolean;
  method: Method;
  salt: string; // base64
  hash: string; // base64 PBKDF2 output
  autoLockMs: AutoLockMs;
  biometricsEnabled: boolean;
  credentialId?: string; // base64url
  privacyBlur: boolean;
  createdAt: number;
}

const KEY = (uid: string) => `disciplineos.lock.v1.${uid}`;
const UNLOCK_KEY = (uid: string) => `disciplineos.lock.unlocked.${uid}`;

export function getConfig(userId: string): LockConfig | null {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch { return null; }
}

export function saveConfig(userId: string, cfg: LockConfig) {
  localStorage.setItem(KEY(userId), JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent("applock:changed"));
}

export function clearConfig(userId: string) {
  localStorage.removeItem(KEY(userId));
  localStorage.removeItem(UNLOCK_KEY(userId));
  window.dispatchEvent(new CustomEvent("applock:changed"));
}

export function markUnlocked(userId: string) {
  sessionStorage.setItem(UNLOCK_KEY(userId), String(Date.now()));
  window.dispatchEvent(new CustomEvent("applock:unlocked"));
}

export function markLocked(userId: string) {
  sessionStorage.removeItem(UNLOCK_KEY(userId));
  window.dispatchEvent(new CustomEvent("applock:locked"));
}

export function isUnlocked(userId: string): boolean {
  return !!sessionStorage.getItem(UNLOCK_KEY(userId));
}

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(secret: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 200_000, hash: "SHA-256" },
    key,
    256,
  );
  return b64encode(bits);
}

export async function createLock(userId: string, method: Method, secret: string, autoLockMs: AutoLockMs): Promise<LockConfig> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(secret, salt);
  const cfg: LockConfig = {
    enabled: true, method, salt: b64encode(salt.buffer), hash, autoLockMs,
    biometricsEnabled: false, privacyBlur: true, createdAt: Date.now(),
  };
  saveConfig(userId, cfg);
  markUnlocked(userId);
  return cfg;
}

export async function verifySecret(cfg: LockConfig, secret: string): Promise<boolean> {
  const salt = b64decode(cfg.salt);
  const h = await derive(secret, salt);
  // constant-time compare
  if (h.length !== cfg.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ cfg.hash.charCodeAt(i);
  return diff === 0;
}

export async function changeSecret(userId: string, cfg: LockConfig, method: Method, secret: string): Promise<LockConfig> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(secret, salt);
  const next: LockConfig = { ...cfg, method, salt: b64encode(salt.buffer), hash };
  saveConfig(userId, next);
  return next;
}

// WebAuthn — platform authenticator, non-discoverable, no server. Presence check only.
export function biometricsSupported(): boolean {
  return typeof window !== "undefined"
    && !!window.PublicKeyCredential
    && !!navigator.credentials
    && (window.isSecureContext ?? location.protocol === "https:");
}

export async function enrollBiometric(userId: string, cfg: LockConfig): Promise<LockConfig> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "DisciplineOS", id: location.hostname },
      user: { id: userIdBytes, name: userId, displayName: "DisciplineOS user" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Biometric enrollment cancelled");
  const rawId = b64encode(cred.rawId);
  const next: LockConfig = { ...cfg, biometricsEnabled: true, credentialId: rawId };
  saveConfig(userId, next);
  return next;
}

export async function verifyBiometric(cfg: LockConfig): Promise<boolean> {
  if (!cfg.credentialId) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const id = b64decode(cfg.credentialId);
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: id.buffer as ArrayBuffer, type: "public-key", transports: ["internal"] }],
      userVerification: "required",
      timeout: 60_000,
      rpId: location.hostname,
    },
  });
  return !!assertion;
}

export function disableBiometric(userId: string, cfg: LockConfig): LockConfig {
  const next: LockConfig = { ...cfg, biometricsEnabled: false, credentialId: undefined };
  saveConfig(userId, next);
  return next;
}

export function autoLockLabel(ms: AutoLockMs): string {
  return ms === 0 ? "Immediately" : ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000} min`;
}
export const AUTO_LOCK_OPTIONS: AutoLockMs[] = [0, 30_000, 60_000, 5 * 60_000, 15 * 60_000];