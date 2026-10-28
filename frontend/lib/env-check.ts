/**
 * Deployment configuration check. Pure (no imports, no I/O) so it runs both at server start (instrumentation.ts) and from
 * `node scripts/check-env.mjs`, and is unit-tested (tests/unit/env-check.test.ts).
 * It reports WHICH variable is wrong and why. It never includes a value in a message.
 */
export type Env = Record<string, string | undefined>;
export type EnvReport = { errors: string[]; warnings: string[] };

/** The ONLY place the MFA test escape hatch is decided: never in production, whatever the variable says. */
export const mfaBypassAllowed = (env: Env) => env.NODE_ENV !== "production" && env.ADMIN_MFA_OPTIONAL === "true";

const WEAK = ["password", "passw0rd", "changeme", "change-me", "secret", "admin", "root", "sportiq", "123456", "12345678", "qwerty", "test", "example", "dev-only-session-secret", "your-"];
const looksWeak = (v: string) => {
  const l = v.toLowerCase();
  return WEAK.some((w) => l === w || (w.length >= 6 && l.includes(w))) || new Set(v).size < 6;
};
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(:\d{1,5})?$/i;
const isHost = (v: string) => HOST.test(v) && !v.includes("*");
const int = (v: string | undefined) => (v !== undefined && v.trim() !== "" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

export function checkEnv(env: Env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = env.NODE_ENV === "production";
  const e = (m: string) => errors.push(m);
  const w = (m: string) => warnings.push(m);
  const has = (k: string) => (env[k] ?? "").trim() !== "";
  const prodErr = (m: string) => (prod ? e(m) : w(m + " (an error in production)"));

  // ---- numbers that would otherwise silently fall back or become NaN ----
  for (const [k, lo, hi] of [["DB_POOL_SIZE", 1, 100], ["HOUSEKEEPING_SECONDS", 5, 86400], ["STORAGE_QUOTA_MB", 0, 100_000_000], ["SHARP_CONCURRENCY", 1, 16], ["PUBLIC_UPLOAD_CONCURRENCY", 1, 32], ["ADMIN_UPLOAD_CONCURRENCY", 1, 32]] as const) {
    if (has(k)) { const n = int(env[k]); if (n === null || n < lo || n > hi) e(`${k} must be a whole number between ${lo} and ${hi}`); }
  }

  // ---- database ----
  let dbHost = "";
  if (!has("DATABASE_URL")) e("DATABASE_URL is not set");
  else {
    try {
      const u = new URL(env.DATABASE_URL!);
      dbHost = u.hostname;
      if (!/^mysql/.test(u.protocol)) e("DATABASE_URL must start with mysql://");
      if (!decodeURIComponent(u.username)) e("DATABASE_URL has no database user");
      const pw = decodeURIComponent(u.password);
      if (!pw) e("DATABASE_URL has no database password");
      else if (prod && (pw.length < 12 || looksWeak(pw))) e("the database password in DATABASE_URL is too short or a known weak/default value (use 12+ random characters)");
      if (!u.pathname.replace(/^\//, "")) e("DATABASE_URL has no database name");
      if (prod && decodeURIComponent(u.username) === "root") w("DATABASE_URL uses the root database user; use a limited user for the website");
      if (prod && !["db", "localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname) && env.DATABASE_SSL !== "true") e("a remote database needs DATABASE_SSL=true");
    } catch { e("DATABASE_URL is not a valid URL (special characters in the password must be percent-encoded)"); }
  }
  void dbHost;

  // ---- admin sign-in ----
  if (prod) {
    if (!has("SESSION_SECRET")) e("SESSION_SECRET is not set");
    else if (env.SESSION_SECRET!.length < 32) e("SESSION_SECRET must be 32+ characters");
    else if (looksWeak(env.SESSION_SECRET!)) e("SESSION_SECRET is a known test/default value or has too little variety");
    if (has("ADMIN_PASSWORD")) e("ADMIN_PASSWORD (plain text) must not be set in production; use ADMIN_PASSWORD_HASH");
    if (!has("ADMIN_PASSWORD_HASH")) e("ADMIN_PASSWORD_HASH is not set");
    else if (!/^scrypt:[0-9a-f]{16,}:[0-9a-f]{128}$/.test(env.ADMIN_PASSWORD_HASH!)) e("ADMIN_PASSWORD_HASH is not in the scrypt:salt:hash format made by scripts/hash-password.mjs");
    const totp = (env.ADMIN_TOTP_SECRET ?? "").replace(/\s/g, "");
    if (!totp) e("ADMIN_TOTP_SECRET (two-factor) is not set");
    else if (!/^[A-Z2-7]{16,}=*$/i.test(totp)) e("ADMIN_TOTP_SECRET is not a valid base32 secret (16+ characters)");
    else if (/JBSWY3DPEHPK3PXP/i.test(totp)) e("ADMIN_TOTP_SECRET is the public documentation/test secret");
    if (has("ADMIN_MFA_OPTIONAL")) e("ADMIN_MFA_OPTIONAL must not be set in production (two-factor is mandatory and this switch is ignored; remove it)");
  } else if (has("SESSION_SECRET") && env.SESSION_SECRET!.length < 16) w("SESSION_SECRET is short");

  // ---- public address and hostnames ----
  let siteHost = "";
  if (!has("SITE_URL")) prodErr("SITE_URL is not set");
  else {
    try {
      const u = new URL(env.SITE_URL!);
      siteHost = u.hostname.toLowerCase();
      if (prod) {
        if (u.protocol !== "https:") e("SITE_URL must be https:// in production");
        if (/^(localhost|127\.|0\.0\.0\.0|\[?::1)/.test(siteHost) || siteHost.endsWith(".local") || siteHost.endsWith(".internal")) e("SITE_URL points at this machine, not your public domain");
        if (/^\d+\.\d+\.\d+\.\d+$/.test(siteHost)) e("SITE_URL must use a domain name, not an IP address");
        if (u.pathname !== "/" || u.search || u.hash) w("SITE_URL should be just the address, with no path");
      }
    } catch { e("SITE_URL is not a valid URL"); }
  }
  const adminHost = (env.ADMIN_HOST ?? "").trim().toLowerCase();
  if (!adminHost) prodErr("ADMIN_HOST is not set (the staff area needs its own hostname, for example staff.example.lk)");
  else {
    if (!isHost(adminHost)) e("ADMIN_HOST must be a plain hostname (no https://, no path, no wildcard)");
    else if (siteHost && adminHost.split(":")[0] === siteHost) e("ADMIN_HOST must differ from the public site hostname");
  }
  const notifyHost = (env.PAYHERE_NOTIFY_HOST ?? "").trim().toLowerCase();
  if (notifyHost) {
    if (!isHost(notifyHost)) e("PAYHERE_NOTIFY_HOST must be a plain hostname");
    else if (notifyHost === adminHost) e("PAYHERE_NOTIFY_HOST must differ from ADMIN_HOST");
  }

  // ---- payments ----
  const anyPayhere = ["PAYHERE_MERCHANT_ID", "PAYHERE_MERCHANT_SECRET", "PAYHERE_MODE", "PAYHERE_APP_ID", "PAYHERE_APP_SECRET"].some(has);
  if (anyPayhere) {
    if (!has("PAYHERE_MERCHANT_ID")) e("PAYHERE_MERCHANT_ID is not set");
    if (!has("PAYHERE_MERCHANT_SECRET")) e("PAYHERE_MERCHANT_SECRET is not set");
    else if (prod && (env.PAYHERE_MERCHANT_SECRET!.length < 12 || looksWeak(env.PAYHERE_MERCHANT_SECRET!))) e("PAYHERE_MERCHANT_SECRET looks like a test value");
    const mode = env.PAYHERE_MODE ?? "";
    if (!["live", "sandbox"].includes(mode)) prodErr("PAYHERE_MODE must be exactly live or sandbox (a blank value switches card payments off)");
    if (mode === "live" && (!has("PAYHERE_APP_ID") || !has("PAYHERE_APP_SECRET"))) e("PAYHERE_MODE=live needs PAYHERE_APP_ID and PAYHERE_APP_SECRET (independent payment verification is mandatory)");
    if (has("PAYHERE_APP_ID") !== has("PAYHERE_APP_SECRET")) e("PAYHERE_APP_ID and PAYHERE_APP_SECRET must be set together");
    if (mode === "live" && has("PAYHERE_API_BASE")) e("PAYHERE_API_BASE is a test hook and must not be set with PAYHERE_MODE=live");
    if (prod && mode === "sandbox") w("PAYHERE_MODE=sandbox: card payments are test payments, no real money moves");
    if (prod && !has("ALERT_WEBHOOK_URL")) w("card payments are on but ALERT_WEBHOOK_URL is not set: payment mismatches will not reach your phone");
  } else if (prod) w("PayHere is not configured: card payments are off (bank transfer only)");
  if (prod && !(has("BANK_NAME") && has("BANK_ACCOUNT_NAME") && has("BANK_ACCOUNT_NUMBER")) && !anyPayhere) w("no way to take payment: set the BANK_* details and/or PayHere");
  if (has("ALERT_WEBHOOK_URL")) { try { if (new URL(env.ALERT_WEBHOOK_URL!).protocol !== "https:" && prod) w("ALERT_WEBHOOK_URL should be https://"); } catch { e("ALERT_WEBHOOK_URL is not a valid URL"); } }
  else if (prod) w("ALERT_WEBHOOK_URL is not set: no phone alerts for failed logins, payments, database or storage problems");

  // ---- client address trust (rate limits) ----
  if (has("CLIENT_IP_HEADER") && !has("PROXY_AUTH_SECRET")) prodErr("CLIENT_IP_HEADER is set but PROXY_AUTH_SECRET is not: anyone able to reach the app could forge the visitor address (see DEPLOY.md)");
  if (has("PROXY_AUTH_SECRET") && env.PROXY_AUTH_SECRET!.length < 24) e("PROXY_AUTH_SECRET must be 24+ characters");
  if (prod && !has("PROXY_AUTH_SECRET")) w("PROXY_AUTH_SECRET is not set: the app trusts the forwarded-address header without proof it came from Caddy (safe only while port 3000 is not reachable except through Caddy)");

  if (prod && env.SEED_DEMO_DATA === "true") w("SEED_DEMO_DATA=true will create demo products; turn it off on the live shop");
  return { errors, warnings };
}
