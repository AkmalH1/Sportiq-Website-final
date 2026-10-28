// Concurrency test of the credit/fail transaction pattern (same locking SQL order and the same planCredit/planFail as lib/orders.ts)
// against the THROWAWAY test database (fake rows are created and removed). Run: node --experimental-strip-types tests/unit/payhere.concurrency.mjs
import mysql from "mysql2/promise";
import { planCredit, planFail } from "../../lib/payhere-logic.ts";
const pool = mysql.createPool(process.env.DATABASE_URL || "mysql://sportiq:sportiq@127.0.0.1:3306/sportiq?connectionLimit=40");
const ref = "TST" + Date.now().toString(36).toUpperCase();
let fails = 0; const check = (l, c) => { console.log((c ? "PASS " : "FAIL ") + l); if (!c) fails++; };
async function tx(fn) { const c = await pool.getConnection(); try { await c.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"); await c.beginTransaction(); const r = await fn(c); await c.commit(); return r; } catch (e) { await c.rollback(); throw e; } finally { c.release(); } }
async function credit(pid, providerRef) {
  return tx(async (c) => {
    const [[h]] = await c.query("SELECT order_id FROM payments WHERE id=?", [pid]);
    const [[o]] = await c.query("SELECT * FROM orders WHERE id=? FOR UPDATE", [h.order_id]);
    const [[p]] = await c.query("SELECT * FROM payments WHERE id=? FOR UPDATE", [pid]);
    const plan = planCredit(p, o); if (!plan.credit) return false;
    await c.query("UPDATE payments SET status='success', provider_ref=COALESCE(?,provider_ref) WHERE id=?", [providerRef, pid]);
    await c.query("UPDATE orders SET paid_amount=?, payment_status=? WHERE id=?", [plan.paid, plan.paymentStatus, o.id]);
    return true;
  });
}
async function fail(pid, to) {
  return tx(async (c) => {
    const [[h]] = await c.query("SELECT order_id FROM payments WHERE id=?", [pid]);
    const [[o]] = await c.query("SELECT * FROM orders WHERE id=? FOR UPDATE", [h.order_id]);
    const [[p]] = await c.query("SELECT * FROM payments WHERE id=? FOR UPDATE", [pid]);
    const plan = planFail(p.status, to); if (plan === "noop" || plan === "ignore-after-success") return plan;
    await c.query("UPDATE payments SET status=? WHERE id=?", [to, pid]);
    if (plan === "reverse") await c.query("UPDATE orders SET paid_amount=GREATEST(0,paid_amount-?) WHERE id=?", [p.amount, o.id]);
    return plan;
  });
}
const [r] = await pool.query("INSERT INTO orders (reference,customer_name,email,phone,address,city,subtotal,total,payment_method,due_now) VALUES (?,?,?,?,?,?,10000,10000,'payhere',10000)", [ref, "T", "t@example.com", "1", "a", "c"]);
const oid = r.insertId;
const mkPay = async (n, amt = 10000) => (await pool.query("INSERT INTO payments (order_id,provider,provider_order_id,amount) VALUES (?, 'payhere', ?, ?)", [oid, `${ref}-${n}`, amt]))[0].insertId;
const paid = async () => (await pool.query("SELECT paid_amount FROM orders WHERE id=?", [oid]))[0][0].paid_amount;
try {
  const p1 = await mkPay(1);
  const res = await Promise.all(Array.from({ length: 30 }, () => credit(p1, "PH-1")));
  check("30 simultaneous callbacks for one payment credit exactly once", res.filter(Boolean).length === 1 && (await paid()) === 10000);
  check("a later duplicate notice credits nothing", (await credit(p1, "PH-1")) === false && (await paid()) === 10000);
  check("delayed failure after success is ignored", (await fail(p1, "failed")) === "ignore-after-success" && (await paid()) === 10000);
  check("chargeback reverses once, replays do nothing", (await Promise.all([fail(p1, "chargeback"), fail(p1, "chargeback"), fail(p1, "chargeback")])).filter((x) => x === "reverse").length === 1 && (await paid()) === 0);
  check("replayed paid notice after chargeback does not re-credit", (await credit(p1, "PH-1")) === false && (await paid()) === 0);
  const p2 = await mkPay(2);
  let dupErr = 0; try { await credit(p2, "PH-1"); } catch (e) { if (e.errno === 1062) dupErr = 1; }
  check("a payment id already used on another payment is refused by UNIQUE and credits nothing", dupErr === 1 && (await paid()) === 0);
  const [[st]] = await pool.query("SELECT status FROM payments WHERE id=?", [p2]); check("...and the failed transaction left that payment untouched", st.status === "initiated");
  const p3 = await mkPay(3), p4 = await mkPay(4);
  await Promise.all([credit(p3, "PH-3"), credit(p4, "PH-4")]);
  check("two different payments racing on one order never exceed the order total", (await paid()) === 10000);
  const p5 = await mkPay(5); await fail(p5, "failed");
  check("out-of-order: failed notice then paid notice on an unpaid-order payment credits", (await credit(p5, "PH-5")) === true);
} finally {
  await pool.query("DELETE FROM orders WHERE id=?", [oid]); await pool.end();
}
console.log(fails ? "FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
