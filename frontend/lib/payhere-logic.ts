/**
 * The money rules for a PayHere notification, as pure functions (no database, no network) so every edge case is unit-tested:
 * tests/unit/payhere-logic.test.ts. lib/orders.ts and app/api/payhere/notify/route.ts apply the result inside a database transaction
 * that already holds row locks (SELECT ... FOR UPDATE on the order, then the payment), so two simultaneous callbacks for the same
 * payment run one after the other and the second one sees status = 'success' and credits nothing.
 */

/** The signed amount/currency must equal what the SERVER calculated for this payment (never trust the browser or the notice alone). */
export function notificationMatches(p: { payhere_amount: string; payhere_currency: string }, pay: { amount: number; currency: string }): boolean {
  return p.payhere_amount === pay.amount.toFixed(2) && p.payhere_currency === pay.currency;
}

export type NotifyPlan =
  | { kind: "credit" }
  | { kind: "pending" }
  | { kind: "fail"; to: "cancelled" | "failed" | "chargeback"; note: string; outcome: string }
  | { kind: "unknown" };

/** PayHere status_code: 2 success, 0 pending, -1 cancelled, -2 failed, -3 chargeback. Anything else is recorded and ignored. */
export function planForStatus(code: string): NotifyPlan {
  switch (code) {
    case "2": return { kind: "credit" };
    case "0": return { kind: "pending" };
    case "-1": return { kind: "fail", to: "cancelled", note: "Cancelled at gateway", outcome: "cancelled" };
    case "-2": return { kind: "fail", to: "failed", note: "Failed at gateway", outcome: "failed" };
    case "-3": return { kind: "fail", to: "chargeback", note: "Charged back", outcome: "chargeback" };
    default: return { kind: "unknown" };
  }
}

export type CreditPlan =
  | { credit: false; reason: "already-credited" | "charged-back" }
  | { credit: true; late: true }
  | { credit: true; late: false; paid: number; excess: number; paymentStatus: "paid" | "partial"; confirm: boolean };

/**
 * What crediting a payment does to its order.
 *  - success already recorded -> nothing (duplicate / simultaneous / replayed notification)
 *  - charged back            -> nothing: a replayed "paid" notice must never re-credit money the bank took back
 *  - order cancelled         -> keep the money visible as a late payment for staff to refund, do not revive the order
 *  - otherwise paid_amount grows by the payment, never above the order total (the rest becomes an overpayment refund item)
 */
export function planCredit(pay: { status: string; amount: number }, order: { stage: string; paid_amount: number; total: number; due_now: number }): CreditPlan {
  if (pay.status === "success") return { credit: false, reason: "already-credited" };
  if (pay.status === "chargeback") return { credit: false, reason: "charged-back" };
  if (order.stage === "Cancelled") return { credit: true, late: true };
  const raw = order.paid_amount + pay.amount;
  const excess = Math.max(0, raw - order.total);
  const paid = Math.min(raw, order.total);
  return {
    credit: true, late: false, paid, excess,
    paymentStatus: paid >= order.total ? "paid" : "partial",
    confirm: order.stage === "Awaiting payment" && paid >= order.due_now,
  };
}

export type FailPlan = "noop" | "apply" | "reverse" | "ignore-after-success";

/** Out-of-order and delayed failure notices: a credited payment is only ever reversed by a chargeback; a chargeback is final. */
export function planFail(current: string, target: "cancelled" | "failed" | "chargeback"): FailPlan {
  if (current === "chargeback" || current === target) return "noop";
  if (current === "success") return target === "chargeback" ? "reverse" : "ignore-after-success";
  return "apply";
}
