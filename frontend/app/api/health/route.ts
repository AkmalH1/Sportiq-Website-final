import { db } from "@/lib/db";
import { alertOnce } from "@/lib/alert";
import { monitorStorage } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Used by Docker's health check. Never reveals details; a failing database is logged and (throttled) sent to the owner's alert webhook. */
export async function GET() {
  try {
    (await db().prepare("SELECT 1").get());
  } catch (e) {
    console.error("[health] database check failed:", e instanceof Error ? e.message.slice(0, 160) : "unknown error");
    void alertOnce("db-down", "Health check: the database is not answering.", 10 * 60 * 1000);
    return Response.json({ ok: false }, { status: 500 });
  }
  try { monitorStorage(); } catch { /* storage monitoring must never fail the health check */ }
  return Response.json({ ok: true });
}
