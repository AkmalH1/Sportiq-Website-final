import "server-only";
import { db } from "./db";

/**
 * Fixed-window counters stored in the database (shared by every app instance, survive restarts).
 *
 * The count-and-increment is ONE atomic statement: INSERT ... ON DUPLICATE KEY UPDATE on the primary key `k`.
 * MySQL/MariaDB take a row lock for the update, so any number of simultaneous requests each get a distinct, increasing count.
 * LAST_INSERT_ID(expr) hands the new value back through the same statement, so there is no separate read to race with.
 * A window starts at the first hit and does not slide, so repeated hits never extend a block.
 */
export async function hit(key: string, windowMs: number): Promise<number> {
  const now = Date.now();
  const r = await db()
    .prepare(
      `INSERT INTO rate_limits (k, n, reset_at) VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
         n = LAST_INSERT_ID(IF(reset_at <= ?, 1, n + 1)),
         reset_at = IF(reset_at <= ?, ?, reset_at)`,
    )
    .run(key, now + windowMs, now, now, now + windowMs);
  // A brand-new row reports no insert id: that is the first hit.
  return r.lastInsertRowid || 1;
}

/** Counts this request and returns true when it is over `max` for the window. */
export async function limited(key: string, max: number, windowMs: number): Promise<boolean> {
  return (await hit(key, windowMs)) > max;
}

/** Current count without adding to it. */
export async function peek(key: string): Promise<number> {
  const row = (await db().prepare("SELECT n FROM rate_limits WHERE k = ? AND reset_at > ?").get(key, Date.now())) as { n: number } | undefined;
  return row?.n ?? 0;
}

/** Remove expired rows (called by the background job). */
export async function pruneRateHits() {
  await db().prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(Date.now() - 60 * 60 * 1000);
  await db().prepare("DELETE FROM rate_hits WHERE at < ?").run(Date.now() - 24 * 3600 * 1000);
}

/** Client address for rate limits: see lib/client-ip.ts (trusts forwarded headers only from our own proxy). */
export { clientIp } from "./client-ip";
