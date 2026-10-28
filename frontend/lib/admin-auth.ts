import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mfaBypassAllowed } from "./env-check";

const COOKIE = "siq_admin";
const TTL_MS = 8 * 60 * 60 * 1000;

const isProd = process.env.NODE_ENV === "production";
const siteHost = () => { try { return new URL(process.env.SITE_URL || "http://localhost:3000").hostname; } catch { return ""; } };
// The built-in development password only works when the site address is this computer, so a dev server exposed by mistake has no default login.
const devPasswordAllowed = () => !isProd && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(siteHost());
// "||" (not "??") so a blank line in .env.local falls back to the dev default.
const password = () => process.env.ADMIN_PASSWORD || (devPasswordAllowed() ? "sportiq-admin" : "");
const secret = () => process.env.SESSION_SECRET || (isProd ? "" : "dev-only-session-secret");

export const devPasswordHint = devPasswordAllowed() && !process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH ? "sportiq-admin" : null;
const hash = () => process.env.ADMIN_PASSWORD_HASH || "";
/** Base32 secret for two-factor codes (see scripts/totp-setup.mjs). */
export const totpSecret = () => (process.env.ADMIN_TOTP_SECRET || "").replace(/\s/g, "");
export const totpRequired = () => totpSecret() !== "";
/**
 * Escape hatch for throwaway test servers only. It is decided by mfaBypassAllowed(): NEVER true when NODE_ENV is "production",
 * whatever ADMIN_MFA_OPTIONAL says, so setting it by mistake on the live server cannot turn two-factor off.
 */
const mfaOptional = () => mfaBypassAllowed(process.env);
/**
 * In production, admin stays DISABLED (it cannot be logged into) unless: the password is stored as a hash, the session secret is
 * 32+ characters, and two-factor is configured. A password-only production admin is not possible.
 */
export const adminProblems = (): string[] => {
  const p: string[] = [];
  if (!(hash() || password())) p.push("ADMIN_PASSWORD_HASH is not set");
  if (!secret()) p.push("SESSION_SECRET is not set");
  if (isProd) {
    if (!hash()) p.push("production needs ADMIN_PASSWORD_HASH (a plain ADMIN_PASSWORD is not accepted)");
    if (secret() && secret().length < 32) p.push("SESSION_SECRET must be 32+ characters");
    if (!totpRequired() && !mfaOptional()) p.push("ADMIN_TOTP_SECRET (two-factor) is not set");
    // A leftover test switch in production is a configuration error: refuse to run admin until it is removed (it would be ignored anyway).
    if ((process.env.ADMIN_MFA_OPTIONAL ?? "") !== "") p.push("ADMIN_MFA_OPTIONAL must not be set in production");
  }
  return p;
};
export const adminConfigured = () => adminProblems().length === 0;

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export function checkPassword(input: string) {
  if (!adminConfigured()) return false;
  const h = hash();
  if (h) {
    // Stored as scrypt:salt:hash (see scripts/hash-password.mjs): the plaintext password never sits on the server.
    const [kind, salt, want] = h.split(":");
    if (kind !== "scrypt" || !salt || !want) return false;
    const got = scryptSync(input, salt, 64);
    const exp = Buffer.from(want, "hex");
    return got.length === exp.length && timingSafeEqual(got, exp);
  }
  const a = Buffer.from(input);
  const b = Buffer.from(password());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Staff type their name at login so the activity log and payment records show who acted, even though the password is shared. */
const cleanName = (n: string) => n.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 40) || "staff";

export async function startAdminSession(name = "") {
  const exp = String(Date.now() + TTL_MS);
  const who = Buffer.from(cleanName(name)).toString("base64url");
  (await cookies()).set(COOKIE, `${exp}.${who}.${sign(`${exp}.${who}`)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

/** Returns the signed-in staff member's name, or null when not logged in. */
export async function adminName(): Promise<string | null> {
  if (!adminConfigured()) return null;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return null;
  const [exp, who, sig] = v.split(".");
  if (!exp || !who || !sig || Number(exp) < Date.now()) return null;
  const good = sign(`${exp}.${who}`);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  return Buffer.from(who, "base64url").toString("utf8") || "staff";
}

export async function isAdmin(): Promise<boolean> {
  return (await adminName()) !== null;
}

/** Call at the top of every admin page and every admin server action. */
export async function requireAdmin() {
  const name = await adminName();
  if (!name) redirect("/admin/login");
  return name;
}

/**
 * "Known device" cookie, issued only after a full successful login (password + code). Under a distributed guessing attack the
 * login form slows down for strangers, but this browser keeps the normal speed, so the owner is never locked out by an attacker.
 */
const TRUST = "siq_trust";
const TRUST_DAYS = 30;
export async function markTrustedDevice() {
  const exp = String(Date.now() + TRUST_DAYS * 86400_000);
  (await cookies()).set(TRUST, `${exp}.${sign("trust." + exp)}`, { httpOnly: true, sameSite: "strict", secure: isProd, path: "/admin", maxAge: TRUST_DAYS * 86400 });
}
export async function isTrustedDevice(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const v = (await cookies()).get(TRUST)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign("trust." + exp);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
