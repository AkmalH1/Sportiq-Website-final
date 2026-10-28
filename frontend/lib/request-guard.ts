/**
 * Small, dependency-free request guards (no Next/server imports so they are unit-tested: tests/unit/request-guard.test.ts).
 *  - readBodyLimited / parseFormLimited: count the bytes of the request STREAM and abort past the limit, BEFORE any multipart parsing.
 *    Content-Length is only an early hint: it may be absent (chunked) or lie, so it is never the only check.
 *  - createGate: bounded concurrency (+ bounded queue) so a burst of uploads cannot exhaust memory / CPU.
 *  - sameOrigin: for plain route handlers (server actions already get Next's Origin/Host check).
 *  - safeAdminPath: redirect targets for admin actions.
 *  - storageDecision: disk quota rule for uploads.
 */

export class BodyTooLarge extends Error {
  limit: number;
  constructor(limit: number) { super(`Request body is larger than ${limit} bytes`); this.limit = limit; }
}
export class BodyTimeout extends Error { constructor() { super("Request body took too long"); } }

export async function readBodyLimited(req: Request, maxBytes: number, timeoutMs = 60_000): Promise<Uint8Array> {
  const cl = req.headers.get("content-length");
  if (cl !== null && /^\d+$/.test(cl) && Number(cl) > maxBytes) throw new BodyTooLarge(maxBytes);
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new BodyTimeout()), timeoutMs); });
  try {
    for (;;) {
      const r = await Promise.race([reader.read(), deadline]);
      if (r.done) break;
      total += r.value.byteLength;
      if (total > maxBytes) throw new BodyTooLarge(maxBytes);
      chunks.push(r.value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

/** Reads the (bounded) body first, and only then lets the platform parse multipart data from those bytes. */
export async function parseFormLimited(req: Request, maxBytes: number, timeoutMs?: number): Promise<FormData> {
  const type = req.headers.get("content-type") ?? "";
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)/i.test(type)) throw new TypeError("Unsupported content type");
  const bytes = await readBodyLimited(req, maxBytes, timeoutMs);
  return await new Response(bytes as BodyInit, { headers: { "content-type": type } }).formData();
}

export class GateFull extends Error { constructor() { super("Too many requests in progress"); } }

/** At most `max` jobs run at once; up to `maxQueue` more wait; beyond that run() rejects immediately with GateFull. */
export function createGate(max: number, maxQueue: number) {
  let active = 0;
  const waiters: (() => void)[] = [];
  return {
    get active() { return active; },
    get queued() { return waiters.length; },
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= max) {
        if (waiters.length >= maxQueue) throw new GateFull();
        await new Promise<void>((res) => waiters.push(res)); // the slot is handed over directly by release()
      } else {
        active++;
      }
      try {
        return await fn();
      } finally {
        const next = waiters.shift();
        if (next) next(); // keeps `active` unchanged: the slot passes to the next waiter
        else active--;
      }
    },
  };
}

/** True when the request names an Origin and it is NOT this site. A missing Origin (non-browser client, old browser) is left to the SameSite=Strict cookie. */
export function sameOrigin(h: Headers, extraHosts: string[] = []): boolean {
  const origin = h.get("origin");
  if (!origin) return true;
  let oh: string;
  try { oh = new URL(origin).host.toLowerCase(); } catch { return false; }
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().toLowerCase();
  return oh === host || extraHosts.map((x) => x.toLowerCase()).includes(oh);
}

const ADMIN_BACK = /^\/admin(?:\/[a-z0-9_-]+){0,3}(?:\?[A-Za-z0-9=&_%.,+~-]{0,200})?$/;
const ADMIN_NO_BACK = new Set(["login", "proof", "photos", "export", "template"]);
/** Only an internal admin page may be a redirect target (no other host, scheme, protocol-relative or backslash tricks, no non-page admin routes). */
export function safeAdminPath(input: unknown, fallback = "/admin"): string {
  if (typeof input !== "string" || input.length > 300 || !ADMIN_BACK.test(input)) return fallback;
  const seg = input.split("?")[0].split("/")[2];
  if (seg && ADMIN_NO_BACK.has(seg)) return fallback;
  return input;
}

/** Disk quota: quotaBytes <= 0 means "not enforced". Public uploads may only use up to `publicShare` of the quota so staff can always upload. */
export function storageDecision(usedBytes: number, addBytes: number, quotaBytes: number, isPublic: boolean, publicShare = 0.9): "ok" | "full" {
  if (!(quotaBytes > 0)) return "ok";
  const limit = isPublic ? quotaBytes * publicShare : quotaBytes;
  return usedBytes + addBytes > limit ? "full" : "ok";
}
