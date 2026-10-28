/**
 * Which URL paths may be answered on which hostname. Pure (no Next imports) so it is unit-tested: tests/unit/host-policy.test.ts.
 *
 *   public host   (SITE_URL host, any other host)  everything EXCEPT /admin. Also the PayHere callback unless a separate callback host is set.
 *   staff host    (ADMIN_HOST)                      /admin/**, /uploads/** (photos shown inside admin), /api/health. Nothing else:
 *                                                   NOT /api/payhere/notify and NOT /api/upload (those are for customers / the gateway).
 *   callback host (PAYHERE_NOTIFY_HOST, optional)   ONLY /api/payhere/notify and /api/health. When set, the public host no longer
 *                                                   answers the notify path either.
 * When ADMIN_HOST is empty (local development) no host restriction applies.
 */
export type HostEnv = { ADMIN_HOST?: string; PAYHERE_NOTIFY_HOST?: string };
export type HostDecision = { action: "allow" } | { action: "redirect"; to: string } | { action: "deny"; status: 404 };

const NOTIFY = "/api/payhere/notify";
const HEALTH = "/api/health";

/** Lower-case, decode, collapse repeated slashes and drop a trailing slash, so /Admin, /admin/, //admin and /%61dmin are judged as /admin. */
export function normalizePath(raw: string): string {
  let p = raw;
  try { p = decodeURIComponent(p); } catch { /* keep as is: an undecodable path never matches an allow-list entry below */ }
  p = p.toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

export const normalizeHost = (h: string | null | undefined) => (h || "").trim().toLowerCase().replace(/\.$/, "").split(":")[0];

const under = (p: string, base: string) => p === base || p.startsWith(base + "/");

export function decideHostAccess(hostHeader: string | null | undefined, rawPath: string, env: HostEnv): HostDecision {
  const staffHost = normalizeHost(env.ADMIN_HOST);
  const notifyHost = normalizeHost(env.PAYHERE_NOTIFY_HOST);
  if (!staffHost && !notifyHost) return { action: "allow" };
  const host = normalizeHost(hostHeader);
  const path = normalizePath(rawPath);
  const deny: HostDecision = { action: "deny", status: 404 };

  if (staffHost && host === staffHost) {
    if (under(path, "/admin") || under(path, "/uploads") || path === HEALTH) return { action: "allow" };
    if (path === "/") return { action: "redirect", to: "/admin" };
    return deny;
  }
  if (notifyHost && host === notifyHost && host !== staffHost) {
    return path === NOTIFY || path === HEALTH ? { action: "allow" } : deny;
  }
  // Public host (or any host we do not know): never the staff area; the callback only when it has not been moved to its own host.
  if (under(path, "/admin")) return deny;
  if (path === NOTIFY && notifyHost) return deny;
  return { action: "allow" };
}
