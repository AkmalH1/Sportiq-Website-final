import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { audit, db, likeEscape, tx, type Handle } from "./db";
import { UNPAID_HOLD_HOURS } from "./config";
import { BALANCE_METHODS, enabledBalanceMethods, type BalanceMethod } from "./balance";
import { isCountry } from "./countries";
import { addonPerUnit, normalizeOptions, optionKey, versionsOffered, type ItemOptions } from "./options";
import { getSettings, optionPrices } from "./settings";
import { FINAL_STAGES, deliveryFor, stagesFor as shippingStages, type DeliveryQuote } from "./shipping";
import type { OrderItemRow, OrderRow } from "./types";
import { planCredit, planFail } from "./payhere-logic";
import { newRef } from "./refs";
import { checkVoucher, recordVoucherUse, releaseVoucherUse } from "./vouchers";
import { issueGiftForOrderIn, voidGiftForOrderIn } from "./gift";
import { splitDiscount } from "./promo-logic";

export class OrderError extends Error {}

export type CartLineInput = { sku: string; qty: number; options?: unknown };

export type CheckoutInput = {
  items: CartLineInput[];
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal?: string;
  country: string;
  delivery: string; // "delivery" | "pickup" (Sri Lanka only); ignored for other countries
  method: "payhere" | "bank";
  plan: "full" | "half";
  creditCode?: string;
  voucherCode?: string;
  /** Random value made once per checkout form. A repeated submit with the same value returns the same order instead of a second one. */
  idempotencyKey?: string;
  /** How the remaining half-payment balance will be collected. Must be one of the methods enabled in Admin > Settings. */
  balanceMethod?: string;
};

export { BALANCE_METHODS, enabledBalanceMethods, type BalanceMethod };


export const stagesFor = shippingStages;

async function event(d: Handle, orderId: number, stage: string, note = "", actor = "system") {
  await d.prepare("INSERT INTO order_events (order_id, stage, note, actor) VALUES (?,?,?,?)").run(orderId, stage, note.slice(0, 600), actor);
}

/** Cancel unpaid orders past the hold window and put their ready stock back. Also run every few minutes by the background job. */
export async function releaseExpired() {
  const rows = (await db()
    .prepare(
      `SELECT id FROM orders WHERE payment_status IN ('pending','partial') AND paid_amount = credit_applied AND stage = 'Awaiting payment'
       AND created_at < UTC_TIMESTAMP() - INTERVAL ? HOUR`,
    )
    .all(UNPAID_HOLD_HOURS)) as { id: number }[];
  for (const r of rows) await cancelUnpaidOrderById(r.id, "system", `Not paid within ${UNPAID_HOLD_HOURS} hours`);
}

async function cancelUnpaidOrderById(orderId: number, actor: string, note: string) {
  await tx(async (d) => {
    const o = (await d.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get(orderId)) as OrderRow | undefined;
    if (!o || o.paid_amount > o.credit_applied || o.stage === "Cancelled") return;
    if (o.credit_applied > 0 && o.credit_code) {
      await d.prepare("UPDATE store_credits SET balance = balance + ? WHERE code = ?").run(o.credit_applied, o.credit_code);
      await d.prepare("INSERT INTO credit_ledger (code, delta, order_reference, note) VALUES (?,?,?, 'Restored: order cancelled')").run(o.credit_code, o.credit_applied, o.reference);
      await d.prepare("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND provider = 'credit'").run(orderId);
    }
    await releaseVoucherUse(d, orderId);
    const items = (await d.prepare("SELECT * FROM order_items WHERE order_id = ? AND source = 'ready' AND sku <> 'GIFTCARD'").all(orderId)) as OrderItemRow[];
    for (const it of items) {
      await d.prepare("UPDATE variants SET stock = stock + ? WHERE sku = ?").run(it.qty, it.sku);
      await d.prepare("INSERT INTO inventory_movements (sku, delta, reason, order_id) VALUES (?,?, 'release', ?)").run(it.sku, it.qty, orderId);
    }
    await d.prepare("UPDATE orders SET payment_status = 'cancelled', stage = 'Cancelled' WHERE id = ?").run(orderId);
    await d.prepare("UPDATE payments SET status = 'cancelled', updated_at = UTC_TIMESTAMP() WHERE order_id = ? AND status IN ('initiated','awaiting','submitted')").run(orderId);
    await event(d, orderId, "Cancelled", note, actor);
  });
}

export async function cancelUnpaidOrder(reference: string, actor: string) {
  const o = (await db().prepare("SELECT id, paid_amount, credit_applied FROM orders WHERE reference = ?").get(reference)) as { id: number; paid_amount: number; credit_applied: number } | undefined;
  if (!o) throw new OrderError("Order not found");
  if (o.paid_amount > o.credit_applied) throw new OrderError("This order already has a payment. Refund handling is manual.");
  await cancelUnpaidOrderById(o.id, actor, "Cancelled by staff");
  await audit(actor, "order.cancel", reference);
}

function validate(i: CheckoutInput) {
  const clean = (s: string) => String(s ?? "").trim();
  if (clean(i.name).length < 2) throw new OrderError("Please enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(i.email))) throw new OrderError("Please enter a valid email address.");
  if (clean(i.phone).replace(/\D/g, "").length < 9) throw new OrderError("Please enter a valid phone number.");
  if (!isCountry(clean(i.country))) throw new OrderError("Please choose your country.");
  const pickup = i.country === "LK" && i.delivery === "pickup";
  if (!pickup) {
    if (clean(i.address).length < 5) throw new OrderError("Please enter your delivery address.");
    if (clean(i.city).length < 2) throw new OrderError("Please enter your city.");
  }
  if (i.country !== "LK" && clean(i.postal ?? "").length < 3) throw new OrderError("Please enter your postal code.");
  if (i.method !== "payhere" && i.method !== "bank") throw new OrderError("Choose a payment method.");
  if (!Array.isArray(i.items) || i.items.length === 0) throw new OrderError("Your cart is empty.");
  if (i.items.length > 30) throw new OrderError("Too many different items in one order.");
}

type Line = {
  sku: string; name: string; size: string; qty: number; price: number; addon: number;
  options: ItemOptions; weight: number; source: "ready" | "preorder";
};

export type PriceInput = { items: CartLineInput[]; plan: "full" | "half"; country: string; delivery: string; creditCode?: string; voucherCode?: string };

/** Price a cart from the database. Prices, option charges, stock split, postage and totals never come from the browser. */
async function priceLines(d: Handle, input: PriceInput, opts: { email?: string; lock?: boolean } = {}) {
  const settings = await getSettings(d);
  const prices = optionPrices(settings);
  if (!Array.isArray(input.items) || input.items.length === 0) throw new OrderError("Your cart is empty.");

  // Merge identical lines (same sku and same options); cap quantity per sku.
  const merged = new Map<string, { sku: string; qty: number; options: ItemOptions }>();
  const perSku = new Map<string, number>();
  for (const it of input.items) {
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new OrderError("Quantity must be between 1 and 10.");
    const options = normalizeOptions(it.options);
    const sku = String(it.sku);
    perSku.set(sku, (perSku.get(sku) ?? 0) + qty);
    const key = sku + "|" + optionKey(options);
    const cur = merged.get(key);
    if (cur) cur.qty += qty;
    else merged.set(key, { sku, qty, options });
  }
  for (const q of perSku.values()) if (q > 10) throw new OrderError("Quantity must be between 1 and 10 per item.");

  const remaining = new Map<string, number>();
  const lines: Line[] = [];
  for (const m of merged.values()) {
    const v = (await d
      .prepare(
        `SELECT v.sku, v.size, v.stock, p.name, p.price_lkr, p.preorder_enabled, p.status, p.customizable, p.sport_slug, p.version, p.weight_g
         FROM variants v JOIN products p ON p.id = v.product_id WHERE v.sku = ?`,
      )
      .get(m.sku)) as
      | { sku: string; size: string; stock: number; name: string; price_lkr: number; preorder_enabled: number; status: string; customizable: number; sport_slug: string; version: string; weight_g: number }
      | undefined;
    if (!v || v.status !== "published") throw new OrderError("An item in your cart is no longer available.");
    if (v.sport_slug === "football" && !versionsOffered(v.version).includes(m.options.version)) throw new OrderError(`${v.name} is not offered in that version. Please choose another.`);
    const hasOptions = optionKey(m.options) !== "";
    // Football jerseys may always choose Fan or Player Version; every other option needs a customisable product.
    const versionOnly = v.sport_slug === "football" && !m.options.custom && !m.options.customImage && m.options.patches.length === 0 && m.options.sleeve === "short";
    if (hasOptions && !v.customizable && !versionOnly) throw new OrderError(`${v.name} cannot be customised. Please remove the options.`);
    const addon = hasOptions ? addonPerUnit(m.options, prices) : 0;
    const left = remaining.get(m.sku) ?? v.stock;
    const readyQty = Math.min(left, m.qty);
    remaining.set(m.sku, left - readyQty);
    const preQty = m.qty - readyQty;
    if (preQty > 0 && !v.preorder_enabled) {
      throw new OrderError(`${v.name} (${v.size}) has only ${v.stock} left and is not available for pre-order.`);
    }
    const base = { sku: m.sku, name: v.name, size: v.size, price: v.price_lkr, addon, options: m.options, weight: v.weight_g };
    if (readyQty > 0) lines.push({ ...base, qty: readyQty, source: "ready" });
    if (preQty > 0) lines.push({ ...base, qty: preQty, source: "preorder" });
  }

  const sum = (src: Line["source"]) => lines.filter((l) => l.source === src).reduce((s, l) => s + (l.price + l.addon) * l.qty, 0);
  const readyTotal = sum("ready");
  const preTotal = sum("preorder");
  const hasPre = preTotal > 0;
  const subtotal = readyTotal + preTotal;
  const grams = lines.reduce((s, l) => s + l.weight * l.qty, 0);

  if (!isCountry(input.country)) throw new OrderError("Please choose your country.");
  let delivery: DeliveryQuote;
  try {
    delivery = await deliveryFor(input.country, input.delivery, grams);
  } catch (e) {
    throw new OrderError(e instanceof Error ? e.message : "Delivery is not available.");
  }
  const shipping = delivery.fee;

  // Voucher: a discount on the merchandise only (never on postage). It is shared between ready-stock and pre-order items in proportion,
  // so the pre-order deposit is worked out from what the customer really pays for those items.
  let discount = 0;
  let voucherCode = "";
  if (String(input.voucherCode ?? "").trim()) {
    const vc = await checkVoucher(d, String(input.voucherCode), subtotal, { email: opts.email, lock: opts.lock });
    if (!vc.ok) throw new OrderError(vc.error);
    discount = vc.discount;
    voucherCode = vc.code;
  }
  const split = splitDiscount(discount, readyTotal, preTotal);
  const readyNet = readyTotal - split.ready;
  const preNet = preTotal - split.pre;
  const total = subtotal - discount + shipping;

  // Half payment is only for Sri Lanka and only for the pre-order items: ready-stock items and postage are always paid in full up front,
  // and only the configured percentage of the pre-order items is the deposit. The balance method is chosen from Admin > Settings.
  const effectivePlan: "full" | "half" = hasPre && input.plan === "half" && input.country === "LK" ? "half" : "full";
  const pct = Math.min(100, Math.max(1, Number(settings.deposit_percent) || 50));
  const deposit = Math.ceil((preNet * pct) / 100);
  const dueNow = effectivePlan === "half" ? readyNet + shipping + deposit : total;
  const dueIfHalf = readyNet + shipping + deposit;

  let credit = 0;
  let creditCode = "";
  let creditEmail = "";
  const code = String(input.creditCode ?? "").trim().toUpperCase();
  if (code) {
    const c = (await d.prepare("SELECT code, email, balance, (expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()) AS expired FROM store_credits WHERE code = ?").get(code)) as
      { code: string; email: string; balance: number; expired: number } | undefined;
    if (!c || c.balance <= 0) throw new OrderError("That store credit code is not valid or has no balance left.");
    if (Number(c.expired)) throw new OrderError("That store credit code has expired.");
    credit = Math.min(c.balance, total);
    creditCode = c.code;
    creditEmail = c.email;
  }
  const payNow = Math.max(0, dueNow - credit);
  return {
    lines, readyTotal, preTotal, hasPre, subtotal, discount, voucherCode, shipping, total, plan: effectivePlan, dueNow, dueIfHalf, balance: total - dueNow,
    delivery, grams, credit, creditCode, creditEmail, payNow,
  };
}

export type Quote = Omit<Awaited<ReturnType<typeof priceLines>>, "creditEmail">;

export async function quoteCart(input: PriceInput): Promise<Quote> {
  const { creditEmail: _ignored, ...q } = await priceLines(db(), input);
  void _ignored;
  return q;
}

export async function createOrder(input: CheckoutInput): Promise<{ reference: string; email: string; payNow: number }> {
  try {
    return await createOrderOnce(input);
  } catch (e) {
    // Two identical submissions racing: the loser hits the unique key, then simply finds the winner's order.
    const err = e as { errno?: number; message?: string };
    if (err.errno === 1062 && String(err.message).includes("orders_idem")) return createOrderOnce(input);
    throw e;
  }
}

async function createOrderOnce(input: CheckoutInput): Promise<{ reference: string; email: string; payNow: number }> {
  validate(input);
  await releaseExpired();
  const email = input.email.trim().toLowerCase();
  const idem = /^[A-Za-z0-9-]{16,64}$/.test(String(input.idempotencyKey ?? "")) ? String(input.idempotencyKey) : null;

  return tx(async (d) => {
    if (idem) {
      // Double click, retry or back button: hand back the order this checkout already created.
      const prior = (await d.prepare("SELECT reference, email, total, paid_amount, due_now FROM orders WHERE idempotency_key = ?").get(idem)) as
        { reference: string; email: string; total: number; paid_amount: number; due_now: number } | undefined;
      if (prior) {
        if (prior.email !== email) throw new OrderError("This checkout was already used. Please refresh the page.");
        return { reference: prior.reference, email: prior.email, payNow: Math.max(0, prior.due_now - prior.paid_amount) };
      }
    }
    const q = await priceLines(d, { items: input.items, plan: input.plan, country: input.country, delivery: input.delivery, creditCode: input.creditCode, voucherCode: input.voucherCode }, { email, lock: true });
    if (q.credit > 0 && q.creditEmail && q.creditEmail.toLowerCase() !== email) {
      throw new OrderError("That store credit belongs to a different email address.");
    }

    let reference = newRef();
    for (let tries = 0; await d.prepare("SELECT 1 FROM orders WHERE reference = ?").get(reference); tries++) {
      if (tries > 5) throw new OrderError("Could not allocate an order reference. Please try again.");
      reference = newRef();
    }

    const pickup = q.delivery.method === "pickup";
    let balanceMethod = "";
    if (q.plan === "half") {
      const allowed = enabledBalanceMethods((await getSettings(d)).balance_methods).filter((m) => (m === "cash_pickup" ? pickup : m === "cash_delivery" ? !pickup : true));
      balanceMethod = String(input.balanceMethod ?? "");
      if (!allowed.includes(balanceMethod as BalanceMethod)) throw new OrderError("Choose how you will pay the remaining balance.");
    }
    const r = await d
      .prepare(
        `INSERT INTO orders (reference, customer_name, email, phone, address, city, subtotal, shipping, total,
           payment_method, payment_plan, due_now, has_preorder, country, delivery_method, postal_code, idempotency_key, balance_method, voucher_code, discount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(reference, input.name.trim(), email, input.phone.trim(), pickup ? "Store pickup" : input.address.trim(), pickup ? "-" : input.city.trim(),
        q.subtotal, q.shipping, q.total, input.method, q.plan, q.dueNow, q.hasPre ? 1 : 0, input.country, q.delivery.method, String(input.postal ?? "").trim(), idem, balanceMethod, q.voucherCode, q.discount);
    const orderId = r.lastInsertRowid;

    for (const l of q.lines) {
      await d.prepare("INSERT INTO order_items (order_id, sku, name, size, qty, unit_price, source, options, addon_price) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(orderId, l.sku, l.name, l.size, l.qty, l.price, l.source, optionKey(l.options) ? JSON.stringify(l.options) : "{}", l.addon);
      if (l.source === "ready") {
        // Atomic: succeeds only if enough stock is still there, so two buyers can never take the last item.
        const upd = await d.prepare("UPDATE variants SET stock = stock - ? WHERE sku = ? AND stock >= ?").run(l.qty, l.sku, l.qty);
        if (upd.changes !== 1) throw new OrderError("Stock changed while ordering. Please review your cart.");
        await d.prepare("INSERT INTO inventory_movements (sku, delta, reason, order_id) VALUES (?,?, 'reserve', ?)").run(l.sku, -l.qty, orderId);
      }
    }
    if (q.voucherCode) {
      if (!(await recordVoucherUse(d, q.voucherCode, orderId, email, q.discount))) throw new OrderError("That voucher has just been fully used. Please remove it and try again.");
    }
    await event(d, orderId, "Awaiting payment", q.plan === "half" ? `Half payment selected. Balance of LKR ${q.balance.toLocaleString("en-LK")}: ${BALANCE_METHODS[balanceMethod as BalanceMethod]}.` : "");

    if (q.credit > 0) {
      const upd = await d.prepare("UPDATE store_credits SET balance = balance - ? WHERE code = ? AND balance >= ?").run(q.credit, q.creditCode, q.credit);
      if (upd.changes !== 1) throw new OrderError("Store credit changed while ordering. Please try again.");
      await d.prepare("INSERT INTO credit_ledger (code, delta, order_reference, note) VALUES (?,?,?, 'Used at checkout')").run(q.creditCode, -q.credit, reference);
      await d.prepare("INSERT INTO payments (order_id, provider, provider_order_id, amount, status, note) VALUES (?,?,?,?,'success','Store credit')")
        .run(orderId, "credit", `${reference}-CR`, q.credit);
      const status = q.credit >= q.total ? "paid" : "partial";
      await d.prepare("UPDATE orders SET paid_amount = ?, credit_applied = ?, credit_code = ?, payment_status = ? WHERE id = ?")
        .run(q.credit, q.credit, q.creditCode, status, orderId);
      await event(d, orderId, status === "paid" ? "Payment received in full" : "Deposit received", `LKR ${q.credit.toLocaleString("en-LK")} store credit`, "system");
      if (q.credit >= q.dueNow) {
        await d.prepare("UPDATE orders SET stage = 'Confirmed' WHERE id = ?").run(orderId);
        await event(d, orderId, "Confirmed", "", "system");
      }
    }
    return { reference, email, payNow: q.payNow };
  });
}

export function amountToPay(o: OrderRow): number {
  if (o.paid_amount < o.due_now) return o.due_now - o.paid_amount;
  return Math.max(0, o.total - o.paid_amount);
}

function tokenSecret() {
  const s = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-session-secret");
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

/** How long a tracking link stays valid. After that the customer simply looks the order up again with reference + email. */
const KEY_DAYS = 90;
const keyMac = (reference: string, email: string, exp: string) =>
  createHmac("sha256", tokenSecret()).update(`${reference.trim().toUpperCase()}:${email.trim().toLowerCase()}:${exp}`).digest("hex").slice(0, 32);

/** Link key for an order: "t_<expiry>_<HMAC>". Customer emails never appear in URLs, history or logs, and a leaked link stops working after KEY_DAYS. */
export function orderKey(reference: string, email: string) {
  const exp = (Date.now() + KEY_DAYS * 86400_000).toString(36);
  return `t_${exp}_${keyMac(reference, email, exp)}`;
}

function keyValid(key: string, reference: string, email: string): boolean {
  const m = /^t_([0-9a-z]{1,12})_([0-9a-f]{32})$/.exec(key);
  if (!m) return false;
  if (parseInt(m[1], 36) < Date.now()) return false; // expired
  const good = keyMac(reference, email, m[1]);
  return timingSafeEqual(Buffer.from(m[2]), Buffer.from(good));
}

/** Credential is either the order's email (typed by the customer) or a link key from orderKey(). */
export async function getOrder(reference: string, credential: string) {
  const o = (await db().prepare("SELECT * FROM orders WHERE reference = ?").get(reference.trim().toUpperCase())) as OrderRow | undefined;
  if (!o) return null;
  const c = credential.trim();
  if (!keyValid(c, o.reference, o.email) && o.email !== c.toLowerCase()) return null;
  return loadOrderParts(o);
}

export async function getOrderAsAdmin(reference: string) {
  const o = (await db().prepare("SELECT * FROM orders WHERE reference = ?").get(reference)) as OrderRow | undefined;
  return o ? loadOrderParts(o) : null;
}

async function loadOrderParts(o: OrderRow) {
  const items = (await db().prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all(o.id)) as OrderItemRow[];
  const events = (await db().prepare("SELECT stage, note, actor, created_at FROM order_events WHERE order_id = ? ORDER BY id").all(o.id)) as {
    stage: string; note: string; actor: string; created_at: string;
  }[];
  const payments = (await db().prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY id").all(o.id)) as PaymentRow[];
  return { order: o, items, events, payments, stages: stagesFor(!!o.has_preorder, o.delivery_method) };
}

export type PaymentRow = {
  id: number; order_id: number; provider: string; provider_order_id: string; provider_ref: string | null;
  amount: number; currency: string; status: string; note: string; verified_by: string | null; created_at: string;
  purpose: string; received_amount: number | null; verified_at: string | null; verification_source: string; proof_file: string | null;
};

/** What a new payment attempt is for, decided on the server from the order's current state. */
export function purposeFor(o: OrderRow): "full" | "deposit" | "balance" {
  if (o.paid_amount >= o.due_now) return "balance";
  return o.payment_plan === "half" ? "deposit" : "full";
}

/** Opens a staff-review item for money that cannot be handled automatically (refund due, late payment, chargeback, mismatch). */
export async function addReconciliation(d: Handle, orderId: number, paymentId: number | null, kind: string, amount: number, detail: string) {
  await d.prepare("INSERT INTO reconciliation_items (order_id, payment_id, kind, amount, detail) VALUES (?,?,?,?,?)").run(orderId, paymentId, kind, amount, detail.slice(0, 300));
}

async function newAttemptIn(d: Handle, order: OrderRow, provider: "payhere" | "bank" | "cash", amount: number): Promise<PaymentRow> {
  const fresh = (await d.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get(order.id)) as OrderRow; // serialise attempts for one order, and read the current paid amount
  const purpose = purposeFor(fresh);
  const n = ((await d.prepare("SELECT COUNT(*) AS n FROM payments WHERE order_id = ?").get(order.id)) as { n: number }).n + 1;
  const poid = `${order.reference}-${n}`;
  await d.prepare("INSERT INTO payments (order_id, provider, provider_order_id, amount, status, purpose) VALUES (?,?,?,?,?,?)")
    .run(order.id, provider, poid, amount, provider === "bank" ? "awaiting" : "initiated", purpose);
  return (await d.prepare("SELECT * FROM payments WHERE provider_order_id = ?").get(poid)) as PaymentRow;
}

export const newPaymentAttempt = (order: OrderRow, provider: "payhere" | "bank" | "cash", amount: number) =>
  tx((d) => newAttemptIn(d, order, provider, amount));

/** Locks the order row, then the payment row, always in that order, so concurrent callbacks cannot deadlock or double-credit. */
async function lockPayment(d: Handle, paymentId: number) {
  const head = (await d.prepare("SELECT order_id FROM payments WHERE id = ?").get(paymentId)) as { order_id: number } | undefined;
  if (!head) return null;
  const o = (await d.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get(head.order_id)) as OrderRow;
  const p = (await d.prepare("SELECT * FROM payments WHERE id = ? FOR UPDATE").get(paymentId)) as PaymentRow;
  return { o, p };
}

async function creditPaymentIn(d: Handle, paymentId: number, providerRef: string | null, actor: string, source = ""): Promise<boolean> {
  const locked = await lockPayment(d, paymentId);
  if (!locked) throw new OrderError("Payment not found");
  const { o, p } = locked;
  const plan = planCredit(p, o);
  if (!plan.credit) return false;
  await d.prepare(`UPDATE payments SET status='success', provider_ref = COALESCE(?, provider_ref), verified_by = ?, received_amount = amount,
      verified_at = UTC_TIMESTAMP(), verification_source = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?`)
    .run(providerRef, actor, source || (p.provider === "payhere" ? "notify" : "staff"), paymentId);
  if (plan.late) {
    // Money arrived after the order was cancelled and its stock released. Do not revive the order or touch stock:
    // keep the money visible and flag it so staff refund it or re-create the order.
    await d.prepare("UPDATE payments SET note = 'LATE PAYMENT on cancelled order. Refund the customer or re-create the order.' WHERE id = ?").run(paymentId);
    await event(d, o.id, "Late payment on cancelled order", `LKR ${p.amount.toLocaleString("en-LK")} received via ${p.provider}. Staff must refund or reinstate.`, actor);
    await audit(actor, "payment.late", `${o.reference} LKR ${p.amount}`, d);
    await addReconciliation(d, o.id, p.id, "late_payment", p.amount, `Payment ${p.provider_order_id} arrived after the order was cancelled. Refund the customer or reinstate the order.`);
    return true;
  }
  const { paid, excess } = plan;
  // The order can never show more than its total as paid. Anything above it is real money held for the customer, so it goes to
  // staff as a refund item instead of silently disappearing into the totals.
  if (excess > 0) {
    await addReconciliation(d, o.id, p.id, "overpayment", excess, `Payment ${p.provider_order_id} brought the total received above the order total by LKR ${excess.toLocaleString("en-LK")}. Refund the difference.`);
    await event(d, o.id, "Overpayment flagged", `LKR ${excess.toLocaleString("en-LK")} above the order total. Staff will refund it.`, "system");
  }
  await d.prepare("UPDATE orders SET paid_amount = ?, payment_status = ? WHERE id = ?").run(paid, plan.paymentStatus, o.id);
  await event(d, o.id, paid >= o.total ? "Payment received in full" : "Deposit received", `LKR ${p.amount.toLocaleString("en-LK")} via ${p.provider}`, actor);
  if (plan.confirm) {
    await event(d, o.id, "Confirmed", "", actor);
    await d.prepare("UPDATE orders SET stage = 'Confirmed' WHERE id = ?").run(o.id);
  }
  // A gift card exists only once its order is paid in full, and is issued at most once.
  if (o.kind === "giftcard" && paid >= o.total) await issueGiftForOrderIn(d, o);
  return true;
}

/** Idempotent: a payment is credited at most once. */
export const creditPayment = (paymentId: number, providerRef: string | null, actor: string, source = ""): Promise<boolean> =>
  tx((d) => creditPaymentIn(d, paymentId, providerRef, actor, source));

export type FailResult = "applied" | "unchanged" | "ignored-after-success";
export async function failPayment(paymentId: number, status: "failed" | "cancelled" | "chargeback", note: string): Promise<FailResult> {
  return tx(async (d): Promise<FailResult> => {
    const locked = await lockPayment(d, paymentId);
    if (!locked) return "unchanged";
    const { o, p } = locked;
    const plan = planFail(p.status, status);
    if (plan === "noop") return "unchanged";
    if (plan === "ignore-after-success") return "ignored-after-success"; // never downgrade a credited payment except by chargeback
    await d.prepare("UPDATE payments SET status = ?, note = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?").run(status, note.slice(0, 500), paymentId);
    if (plan === "reverse") {
      await d.prepare("UPDATE orders SET paid_amount = GREATEST(0, paid_amount - ?), payment_status = 'failed' WHERE id = ?").run(p.amount, o.id);
      await event(d, o.id, "Chargeback", "Payment charged back. Staff review needed.", "system");
      await addReconciliation(d, o.id, paymentId, "chargeback", p.amount, `Payment ${p.provider_order_id} was charged back. Decide whether to hold or cancel the order.`);
      if (o.kind === "giftcard") await voidGiftForOrderIn(d, o.id);
    }
    return "applied";
  });
}

export async function setStage(reference: string, stage: string, note: string, actor: string) {
  await tx(async (d) => {
    const order = (await d.prepare("SELECT * FROM orders WHERE reference = ? FOR UPDATE").get(reference)) as OrderRow | undefined;
    if (!order) throw new OrderError("Order not found");
    const stages = stagesFor(!!order.has_preorder, order.delivery_method);
    if (!stages.includes(stage)) throw new OrderError("That stage does not apply to this order.");
    if (order.stage === "Cancelled") throw new OrderError("This order is cancelled.");
    if (order.paid_amount < order.due_now) throw new OrderError("The required payment has not been received yet.");
    if (FINAL_STAGES.includes(stage) && order.paid_amount < order.total) {
      throw new OrderError("The balance is still unpaid. Record the cash collected (or the online payment) before marking this complete.");
    }
    await d.prepare("UPDATE orders SET stage = ? WHERE id = ?").run(stage, order.id);
    await event(d, order.id, stage, note, actor);
  });
  await audit(actor, "order.stage", `${reference} -> ${stage}`);
}

/** Staff records cash taken on delivery or at the store, for example the balance of a half-payment pre-order. */
export async function recordCash(reference: string, amount: number, actor: string) {
  if (!Number.isInteger(amount) || amount < 1) throw new OrderError("Enter the cash amount as a whole number.");
  await tx(async (d) => {
    const order = (await d.prepare("SELECT * FROM orders WHERE reference = ? FOR UPDATE").get(reference)) as OrderRow | undefined;
    if (!order) throw new OrderError("Order not found");
    if (order.stage === "Cancelled") throw new OrderError("This order is cancelled.");
    if (order.paid_amount + amount > order.total) throw new OrderError("That is more than the amount still owing.");
    const p = await newAttemptIn(d, order, "cash", amount);
    await creditPaymentIn(d, p.id, null, actor, "staff");
  });
  await audit(actor, "payment.cash", `${reference} LKR ${amount}`);
}

/** The remaining balance of a half-paid order may only be collected by a method staff have enabled in Admin > Settings. */
export async function balanceMethodAllowed(order: OrderRow, method: "bank" | "online"): Promise<boolean> {
  if (purposeFor(order) !== "balance") return true;
  return enabledBalanceMethods((await getSettings()).balance_methods).includes(method);
}

export async function submitBankProof(reference: string, email: string, bankRef: string, note: string, proofFile: string | null = null) {
  const parts = await getOrder(reference, email);
  if (!parts) throw new OrderError("We could not find that order.");
  const ref = bankRef.trim();
  if (ref.length < 4 || ref.length > 60) throw new OrderError("Enter the transaction reference from your bank receipt.");
  const { order } = parts;
  if (order.payment_status === "paid" || order.stage === "Cancelled") throw new OrderError("This order does not need a payment.");
  if (!(await balanceMethodAllowed(order, "bank"))) throw new OrderError("The remaining balance cannot be paid by bank transfer for this order. Please use one of the methods shown on your order page.");
  await tx(async (d) => {
    const open = (await d
      .prepare("SELECT * FROM payments WHERE order_id = ? AND provider = 'bank' AND status IN ('awaiting','rejected','submitted') ORDER BY id DESC LIMIT 1")
      .get(order.id)) as PaymentRow | undefined;
    const payment = open && open.amount === amountToPay(order) ? open : await newAttemptIn(d, order, "bank", amountToPay(order));
    try {
      await d.prepare("UPDATE payments SET provider_ref = ?, status = 'submitted', note = ?, proof_file = COALESCE(?, proof_file), updated_at = UTC_TIMESTAMP() WHERE id = ?")
        .run(ref, note.trim().slice(0, 300), proofFile, payment.id);
    } catch (e) {
      if ((e as { errno?: number }).errno === 1062) throw new OrderError("This bank reference has already been used on another payment.");
      throw e;
    }
    await event(d, order.id, "Bank payment submitted", `Reference ${ref}${proofFile ? " with receipt photo" : ""}. Waiting for staff to verify.`, "customer");
  });
}

export async function rejectBankPayment(paymentId: number, note: string, actor: string) {
  await tx(async (d) => {
    const locked = await lockPayment(d, paymentId);
    if (!locked || locked.p.provider !== "bank" || locked.p.status === "success") throw new OrderError("This payment cannot be rejected.");
    await d.prepare("UPDATE payments SET status='rejected', note=?, provider_ref = NULL, verified_by = ?, verified_at = UTC_TIMESTAMP(), verification_source = 'staff', updated_at = UTC_TIMESTAMP() WHERE id = ?").run(note.slice(0, 500), actor, paymentId);
    await event(d, locked.p.order_id, "Bank payment rejected", note, actor);
    await audit(actor, "payment.reject", locked.p.provider_order_id, d);
  });
}

export async function confirmBankPayment(paymentId: number, actor: string) {
  const p = (await db().prepare("SELECT * FROM payments WHERE id = ?").get(paymentId)) as PaymentRow | undefined;
  if (!p || p.provider !== "bank") throw new OrderError("Bank payment not found.");
  if (!p.provider_ref) throw new OrderError("The customer has not submitted a bank reference yet.");
  const credited = await creditPayment(paymentId, null, actor, "staff");
  if (credited) await audit(actor, "payment.confirm", `${p.provider_order_id} ${p.provider_ref}`);
}

export async function listOrders(filter?: { status?: string; q?: string }) {
  const where: string[] = [];
  const args: string[] = [];
  if (filter?.status) { where.push("payment_status = ?"); args.push(filter.status); }
  if (filter?.q) { where.push("(reference LIKE ? OR email LIKE ? OR customer_name LIKE ? OR phone LIKE ?)"); const l = `%${likeEscape(filter.q)}%`; args.push(l, l, l, l); }
  return (await db().prepare(`SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 200`).all(...args)) as OrderRow[];
}
