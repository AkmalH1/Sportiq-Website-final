import "server-only";
import { db, tx } from "./db";
import { addReconciliation, creditPayment, type PaymentRow } from "./orders";
import { verifyConfigured, verifyPayHerePayment } from "./payhere-verify";

/** Opens one staff review item per payment (the gateway and this job may both report the same problem). */
export async function flagUnverified(pay: PaymentRow, reason: string) {
  await tx(async (d) => {
    const dup = await d.prepare("SELECT 1 FROM reconciliation_items WHERE payment_id = ? AND kind = 'unverified_payment' AND status = 'open'").get(pay.id);
    if (!dup) await addReconciliation(d, pay.order_id, pay.id, "unverified_payment", pay.amount,
      `PayHere sent a signed "paid" notice for ${pay.provider_order_id} but PayHere's own records do not confirm it (${reason}). NOT credited. Check the PayHere dashboard before shipping.`);
  });
}

/**
 * Notifications that arrived while the PayHere lookup was unreachable are re-checked every few minutes for 24 hours.
 * Only a confirmed payment is credited; a payment PayHere denies goes to staff review; a still-unreachable one is tried again.
 */
export async function retryUnverifiedPayments() {
  if (!verifyConfigured()) return;
  const rows = (await db().prepare(
    `SELECT e.id, e.provider_order_id, e.payload FROM payment_events e
      WHERE e.provider = 'payhere' AND e.outcome = 'verification unavailable' AND e.created_at > UTC_TIMESTAMP() - INTERVAL 24 HOUR
        AND NOT EXISTS (SELECT 1 FROM payment_events f WHERE f.provider_order_id = e.provider_order_id AND f.id > e.id
                        AND (f.outcome LIKE 'credited%' OR f.outcome LIKE 'rejected: not confirmed%'))
      ORDER BY e.id DESC LIMIT 50`,
  ).all()) as { id: number; provider_order_id: string; payload: string }[];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.provider_order_id)) continue;
    seen.add(r.provider_order_id);
    const pay = (await db().prepare("SELECT * FROM payments WHERE provider_order_id = ? AND provider = 'payhere'").get(r.provider_order_id)) as PaymentRow | undefined;
    if (!pay || pay.status === "success") continue;
    let notified = "";
    try { notified = String((JSON.parse(r.payload) as { payment_id?: string }).payment_id ?? ""); } catch { /* ignore */ }
    const v = await verifyPayHerePayment(pay.provider_order_id, pay.amount, pay.currency, notified);
    const log = (o: string) => db().prepare("INSERT INTO payment_events (provider, provider_order_id, payload, outcome, payment_id) VALUES ('payhere', ?, ?, ?, ?)").run(pay.provider_order_id, r.payload, o, pay.id);
    if (v.state === "verified") {
      await creditPayment(pay.id, notified || null, "payhere", "notify+retrieval");
      await log("credited (verified on retry)");
    } else if (v.state === "rejected") {
      await flagUnverified(pay, v.reason);
      await log("rejected: not confirmed by PayHere (retry)");
    }
  }
}
