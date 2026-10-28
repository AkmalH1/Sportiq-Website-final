import { timingSafeEqual } from "node:crypto";

/**
 * Client IP behind ONE trusted reverse proxy (Caddy), optionally behind a CDN that Caddy itself is configured to trust.
 *
 * Forwarded-address headers are only believable when they were set by OUR proxy. Caddy proves that by adding
 * `X-Proxy-Auth: <PROXY_AUTH_SECRET>` (a shared secret the visitor never sees; see the Caddyfile). When PROXY_AUTH_SECRET is set:
 *   - a request carrying the right secret -> trusted: use CLIENT_IP_HEADER (if set), else X-Real-Client-IP (set by Caddy to its own
 *     verified {client_ip}), else the LAST X-Forwarded-For entry (the one Caddy appended; earlier entries can be forged by the visitor);
 *   - a request without it (someone reached the app directly, not via Caddy) -> every forwarded header is ignored and the visitor
 *     is keyed "direct", so nobody can pick their own address or dodge a limit by inventing one.
 * When PROXY_AUTH_SECRET is NOT set (older deployments, local development) the previous behaviour is kept so nothing breaks:
 * last X-Forwarded-For entry, or CLIENT_IP_HEADER if set. scripts/check-env.mjs rejects CLIENT_IP_HEADER without the secret in production.
 */
export function clientIp(h: Headers, env: Record<string, string | undefined> = process.env): string {
  const secret = env.PROXY_AUTH_SECRET ?? "";
  if (secret) {
    const got = h.get("x-proxy-auth") ?? "";
    const a = Buffer.from(got);
    const b = Buffer.from(secret);
    if (!(a.length === b.length && timingSafeEqual(a, b))) return "direct";
  }
  // Behind a CDN such as Cloudflare every visitor reaches Caddy from the CDN's address. Prefer configuring Caddy's trusted_proxies
  // (then X-Real-Client-IP is already right). CLIENT_IP_HEADER=cf-connecting-ip also works, but only with PROXY_AUTH_SECRET set.
  const custom = env.CLIENT_IP_HEADER?.toLowerCase();
  if (custom) { const v = h.get(custom)?.split(",")[0]?.trim(); if (v) return v; }
  if (secret) { const v = h.get("x-real-client-ip")?.trim(); if (v) return v; }
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? h.get("x-real-ip") ?? "local";
}
