/** Runs once when the server starts: background housekeeping so nothing depends on a visitor triggering it. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Refuse to start with an unsafe production configuration (see lib/env-check.ts; the same check runs from scripts/check-env.mjs).
  // Messages name the variable, never its value. Skipped while `next build` collects pages.
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    const { checkEnv } = await import("./lib/env-check");
    const { errors, warnings } = checkEnv(process.env);
    for (const m of warnings) console.warn("[config] warning:", m);
    if (errors.length) {
      for (const m of errors) console.error("[config] ERROR:", m);
      // Only the automated test servers (SPORTIQ_E2E=1 AND a localhost SITE_URL, which no live shop can have) may start despite errors.
      // Two-factor is still mandatory for them: lib/admin-auth.ts ignores ADMIN_MFA_OPTIONAL in production.
      const testServer = process.env.SPORTIQ_E2E === "1" && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.SITE_URL ?? "");
      if (process.env.NODE_ENV === "production" && !testServer) {
        console.error("[config] Refusing to start with an unsafe production configuration. Fix the variables above (see DEPLOY.md).");
        process.exit(1);
      }
    }
  }
  const { releaseExpired } = await import("./lib/orders");
  const { pruneRateHits } = await import("./lib/ratelimit");
  const { retryUnverifiedPayments } = await import("./lib/payhere-retry");
  const { alertOnce } = await import("./lib/alert");
  const { monitorStorage } = await import("./lib/upload");
  const run = async () => {
    try {
      await releaseExpired();
      await retryUnverifiedPayments();
      await pruneRateHits();
      monitorStorage();
    } catch (e) {
      console.error("[housekeeping]", e instanceof Error ? e.message : e);
      void alertOnce("housekeeping", "Background housekeeping failed (expired-order release, payment re-checks). Check the server log and the database.", 30 * 60 * 1000);
    }
  };
  setTimeout(() => void run(), 15_000);
  setInterval(() => void run(), Math.max(5, Number(process.env.HOUSEKEEPING_SECONDS || 300)) * 1000).unref();
}
