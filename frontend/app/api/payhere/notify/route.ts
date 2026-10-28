import { db, tx } from "@/lib/db";
import { addReconciliation, creditPayment, failPayment, type PaymentRow } from "@/lib/orders";
import { clientIp, limited } from "@/lib/ratelimit";
import { notifySignature, payhereAmount, payhereConfig, safeEqual } from "@/lib/payhere";
import { notificationMatches, planForStatus } from "@/lib/payhere-logic";
import { alertOnce } from "@/lib/alert";
import { BodyTimeout, BodyTooLarge, parseFormLimited } from "@/lib/request-guard";
import { verifyConfigured, verifyPayHerePayment } from "@/lib/payhere-verify";
import { flagUnverified } from "@/lib/payhere-retry";

export const dynamic = "force-dynamic";

/** Only the fields needed to investigate a payment are stored. The signature and merchant secret never are. */
async function log(orderId: string | null, payload: Record<string, string>, outcome: string, paymentId: number | null = null) {
  const safe = { ...payload };
  delete safe.md5sig;
  await db().prepare("INSERT INTO payment_events (provider, provider_order_id, payload, outcome, payment_id) VALUES ('payhere', ?, ?, ?, ?)")
    .run(orderId, JSON.stringify(safe).slice(0, 2000), outcome, paymentId);
}

export async function POST(req: Request) {
  const cfg = payhereConfig();
  // A genuine notification is a tiny form post. Refuse anything large (counted on the stream: Content-Length may be missing or false),
  // and slow down floods before doing any work.
  if (await limited("notify:" + clientIp(req.headers), 240, 60 * 1000)) return new Response("Too many requests", { status: 429 });
  let form: FormData;
  try {
    form = await parseFormLimited(req, 4096, 10_000);
  } catch (e) {
    if (e instanceof BodyTooLarge) return new Response("Too large", { status: 413 });
    if (e instanceof BodyTimeout) return new Response("Timeout", { status: 408 });
    return new Response("Bad request", { status: 400 });
  }
  const get = (k: string) => String(form.get(k) ?? "").slice(0, 200);
  const p = {
    merchant_id: get("merchant_id"),
    order_id: get("order_id"),
    payment_id: get("payment_id"),
    payhere_amount: get("payhere_amount"),
    payhere_currency: get("payhere_currency"),
    status_code: get("status_code"),
    md5sig: get("md5sig"),
  };

  if (!cfg.configured) {
    await log(p.order_id, p, "rejected: not configured");
    return new Response("Not configured", { status: 503 });
  }
  const expected = notifySignature(p, cfg.secret);
  if (p.merchant_id !== cfg.merchantId || !safeEqual(expected, p.md5sig.toUpperCase())) {
    await log(p.order_id, p, "rejected: bad signature");
    void alertOnce("payhere-badsig", "PayHere callback rejected: bad signature or merchant id. Check PAYHERE_MERCHANT_ID/SECRET if real payments are failing.", 30 * 60 * 1000);
    return new Response("Invalid signature", { status: 400 });
  }

  const pay = (await db().prepare("SELECT * FROM payments WHERE provider_order_id = ? AND provider = 'payhere'").get(p.order_id)) as PaymentRow | undefined;
  if (!pay) {
    await log(p.order_id, p, "rejected: unknown order");
    return new Response("Unknown order", { status: 404 });
  }
  // The stored, server-calculated amount and currency must match what the gateway reports.
  if (!notificationMatches(p, pay)) {
    await log(p.order_id, p, "rejected: amount or currency mismatch", pay.id);
    // The signature was valid, so money may really have moved for a different amount. Staff must look at it.
    await tx(async (d) => {
      // The gateway retries notifications, so open one review item per payment, not one per retry.
      const dup = await d.prepare("SELECT 1 FROM reconciliation_items WHERE payment_id = ? AND kind = 'amount_mismatch' AND status = 'open'").get(pay.id);
      if (!dup) await addReconciliation(d, pay.order_id, pay.id, "amount_mismatch", Math.round(Number(p.payhere_amount)) || 0,
        `PayHere reported ${p.payhere_amount} ${p.payhere_currency} for ${pay.provider_order_id} but ${payhereAmount(pay.amount)} ${pay.currency} was expected. Not credited.`);
    });
    void alertOnce("payhere-mismatch:" + pay.id, `PayHere reported a different amount/currency for payment ${pay.provider_order_id}. Not credited; see Payment issues in admin.`, 6 * 3600_000);
    return new Response("Amount mismatch", { status: 400 });
  }

  const plan = planForStatus(p.status_code);
  if (plan.kind === "credit") {
    // Second, independent check: ask PayHere's own Retrieval API whether this payment really exists and was RECEIVED for this
    // amount. A forged or replayed notification cannot pass this even if the signature were somehow known.
    let source = "";
    if (verifyConfigured()) {
      const v = await verifyPayHerePayment(pay.provider_order_id, pay.amount, pay.currency, p.payment_id);
      if (v.state === "rejected") {
        await log(p.order_id, p, "rejected: not confirmed by PayHere", pay.id);
        await flagUnverified(pay, v.reason);
        void alertOnce("payhere-unverified:" + pay.id, `PayHere sent a "paid" notice for ${pay.provider_order_id} that PayHere's own records do not confirm. NOT credited. Check the PayHere dashboard.`, 6 * 3600_000);
        return new Response("Not confirmed", { status: 400 });
      }
      if (v.state === "unavailable") {
        // Never credit on a guess. A background job re-checks this payment; a 503 also lets PayHere resend.
        await log(p.order_id, p, "verification unavailable", pay.id);
        void alertOnce("payhere-verify-down", "PayHere's payment lookup is unreachable or refusing our credentials: card payments are held (not lost) and re-checked automatically.", 30 * 60 * 1000);
        return new Response("Verification unavailable", { status: 503 });
      }
      source = "notify+retrieval";
    }
    let credited = false;
    try {
      credited = await creditPayment(pay.id, p.payment_id || null, "payhere", source);
    } catch (e) {
      // UNIQUE(provider, provider_ref): the same gateway payment id is already attached to ANOTHER payment. Never credit twice;
      // put it in front of staff, because either PayHere or someone is reusing an id.
      if ((e as { errno?: number }).errno !== 1062) throw e;
      await log(p.order_id, p, "rejected: payment id already used on another payment", pay.id);
      await tx(async (d) => {
        const dup = await d.prepare("SELECT 1 FROM reconciliation_items WHERE payment_id = ? AND kind = 'unverified_payment' AND status = 'open'").get(pay.id);
        if (!dup) await addReconciliation(d, pay.order_id, pay.id, "unverified_payment", pay.amount, `PayHere reported payment id already recorded on a different payment, for ${pay.provider_order_id}. NOT credited. Check the PayHere dashboard.`);
      });
      void alertOnce("payhere-reused-id:" + pay.id, `A PayHere payment id was reused on ${pay.provider_order_id}. Not credited; see Payment issues in admin.`, 6 * 3600_000);
      return new Response("Duplicate payment id", { status: 409 });
    }
    await log(p.order_id, p, credited ? "credited" : "duplicate ignored", pay.id);
  } else if (plan.kind === "pending") {
    await log(p.order_id, p, "pending", pay.id);
  } else if (plan.kind === "fail") {
    const r = await failPayment(pay.id, plan.to, plan.note);
    await log(p.order_id, p, r === "ignored-after-success" ? `${plan.outcome} notice ignored (already paid)` : r === "unchanged" ? `${plan.outcome} (no change)` : plan.outcome, pay.id);
    if (plan.to === "chargeback" && r === "applied") void alertOnce("payhere-chargeback:" + pay.id, `Chargeback on ${pay.provider_order_id}. See Payment issues in admin.`, 24 * 3600_000);
  } else {
    await log(p.order_id, p, "unknown status", pay.id);
  }
  return new Response("OK", { status: 200 });
}
