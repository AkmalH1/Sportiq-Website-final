import "server-only";

/**
 * Optional owner alerts. Set ALERT_WEBHOOK_URL to a Slack/Discord-compatible or ntfy.sh URL and security events
 * (failed logins, lockouts, payment mismatches) are pushed to your phone. Never throws, never blocks the request for long.
 */
export async function alertOwner(text: string) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[SPORTIQ] ${text}`.slice(0, 500), content: `[SPORTIQ] ${text}`.slice(0, 500) }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* alerting must never break the site */
  }
}

const lastSent = new Map<string, number>();
/** Like alertOwner, but at most once per `everyMs` for the same key, so a failing database or a flood of bad callbacks sends one message, not thousands. The text must never contain secrets. */
export async function alertOnce(key: string, text: string, everyMs = 15 * 60 * 1000) {
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < everyMs) return;
  lastSent.set(key, now);
  if (lastSent.size > 200) for (const [k, t] of lastSent) if (now - t > everyMs) lastSent.delete(k);
  console.error(`[alert] ${text}`.slice(0, 300));
  await alertOwner(text);
}
