import test from "node:test";
import assert from "node:assert/strict";
import { notificationMatches, planCredit, planFail, planForStatus } from "../../lib/payhere-logic.ts";

const order = (o = {}) => ({ stage: "Awaiting payment", paid_amount: 0, total: 10000, due_now: 10000, ...o });

test("wrong amount or currency never matches", () => {
  const pay = { amount: 10000, currency: "LKR" };
  assert.ok(notificationMatches({ payhere_amount: "10000.00", payhere_currency: "LKR" }, pay));
  for (const [a, c] of [["9999.00", "LKR"], ["10000.00", "USD"], ["10000", "LKR"], ["100000.00", "LKR"], ["", ""]]) assert.ok(!notificationMatches({ payhere_amount: a, payhere_currency: c }, pay));
});
test("status codes map; unknown ones do nothing", () => {
  assert.equal(planForStatus("2").kind, "credit");
  assert.equal(planForStatus("0").kind, "pending");
  assert.deepEqual(planForStatus("-3"), { kind: "fail", to: "chargeback", note: "Charged back", outcome: "chargeback" });
  for (const c of ["", "1", "3", "abc", "2 "]) assert.equal(planForStatus(c).kind, "unknown", c);
});
test("duplicate / simultaneous notice: second sees success and credits nothing", () => {
  const first = planCredit({ status: "initiated", amount: 10000 }, order());
  assert.ok(first.credit && !first.late && first.paid === 10000 && first.paymentStatus === "paid" && first.confirm);
  assert.deepEqual(planCredit({ status: "success", amount: 10000 }, order({ paid_amount: 10000, stage: "Confirmed" })), { credit: false, reason: "already-credited" });
});
test("deposit then balance; never above total; overpayment flagged", () => {
  const dep = planCredit({ status: "initiated", amount: 5000 }, order({ due_now: 5000 }));
  assert.ok(dep.credit && !dep.late && dep.paymentStatus === "partial" && dep.confirm && dep.paid === 5000);
  const over = planCredit({ status: "initiated", amount: 7000 }, order({ paid_amount: 5000, stage: "Confirmed", due_now: 5000 }));
  assert.ok(over.credit && !over.late && over.paid === 10000 && over.excess === 2000 && over.paymentStatus === "paid" && !over.confirm);
});
test("late payment on cancelled order is kept visible, order not revived", () => assert.deepEqual(planCredit({ status: "failed", amount: 1 }, order({ stage: "Cancelled" })), { credit: true, late: true }));
test("out-of-order: failed notice then success still credits; chargeback is final (replayed paid notice cannot re-credit)", () => {
  assert.ok(planCredit({ status: "failed", amount: 10000 }, order()).credit);
  assert.deepEqual(planCredit({ status: "chargeback", amount: 10000 }, order()), { credit: false, reason: "charged-back" });
});
test("delayed failure after success is ignored; only chargeback reverses", () => {
  assert.equal(planFail("success", "failed"), "ignore-after-success");
  assert.equal(planFail("success", "cancelled"), "ignore-after-success");
  assert.equal(planFail("success", "chargeback"), "reverse");
  assert.equal(planFail("chargeback", "failed"), "noop");
  assert.equal(planFail("chargeback", "chargeback"), "noop");
  assert.equal(planFail("initiated", "failed"), "apply");
  assert.equal(planFail("failed", "failed"), "noop");
});
