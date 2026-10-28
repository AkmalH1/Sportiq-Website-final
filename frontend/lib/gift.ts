import "server-only";
import { randomInt } from "node:crypto";
import { db, tx, type Handle } from "./db";
import { GIFT_CODE_ALPHABET, giftPrice, parseTiers } from "./promo-logic";
import { newRef } from "./refs";
import { getSettings } from "./settings";

export class GiftError extends Error {}

export type GiftConfig = { tiers: { face: number; percent: number }[]; validMonths: number };
export async function giftConfig(d: Handle = db()): Promise<GiftConfig> {
  const s = await getSettings(d);
  const months = Math.round(Number(s.giftcard_valid_months));
  return { tiers: parseTiers(s.giftcard_tiers), validMonths: Number.isFinite(months) && months >= 1 && months <= 60 ? months : 12 };
}

const newGiftCode = () => {
  const g = () => Array.from({ length: 4 }, () => GIFT_CODE_ALPHABET[randomInt(GIFT_CODE_ALPHABET.length)]).join("");
  return `GC-${g()}-${g()}-${g()}`;
};

export type GiftOrderInput = {
  face: number; name: string; email: string; phone: string; recipientName: string; message: string; method: "payhere" | "bank"; idempotencyKey?: string;
};

/** Creates an unpaid gift-card order. The card itself does not exist until the payment is confirmed. */
export async function createGiftOrder(i: GiftOrderInput): Promise<{ reference: string; email: string; payNow: number }> {
  const clean = (s: string, max: number) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, max);
  const name = clean(i.name, 100);
  const email = clean(i.email, 200).toLowerCase();
  if (name.length < 2) throw new GiftError("Please enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new GiftError("Please enter a valid email address.");
  if (clean(i.phone, 40).replace(/\D/g, "").length < 9) throw new GiftError("Please enter a valid phone number.");
  if (i.method !== "payhere" && i.method !== "bank") throw new GiftError("Choose a payment method.");
  const idem = /^[A-Za-z0-9-]{16,64}$/.test(String(i.idempotencyKey ?? "")) ? String(i.idempotencyKey) : null;
  const cfg = await giftConfig();
  const quote = giftPrice(Math.round(Number(i.face)), cfg.tiers);
  if (!quote) throw new GiftError("Choose a gift card amount between LKR 2,000 and LKR 100,000.");

  try {
    return await tx(async (d) => {
      if (idem) {
        const prior = (await d.prepare("SELECT reference, email, due_now, paid_amount, kind FROM orders WHERE idempotency_key = ?").get(idem)) as
          { reference: string; email: string; due_now: number; paid_amount: number; kind: string } | undefined;
        if (prior) {
          if (prior.email !== email || prior.kind !== "giftcard") throw new GiftError("This form was already used. Please refresh the page.");
          return { reference: prior.reference, email: prior.email, payNow: Math.max(0, prior.due_now - prior.paid_amount) };
        }
      }
      let reference = newRef();
      for (let t = 0; await d.prepare("SELECT 1 FROM orders WHERE reference = ?").get(reference); t++) {
        if (t > 5) throw new GiftError("Could not allocate an order reference. Please try again.");
        reference = newRef();
      }
      const r = await d
        .prepare(
          `INSERT INTO orders (reference, customer_name, email, phone, address, city, subtotal, shipping, total, payment_method, payment_plan, due_now,
             has_preorder, country, delivery_method, postal_code, idempotency_key, balance_method, kind)
           VALUES (?,?,?,?, 'Digital gift card', '-', ?,0,?, ?, 'full', ?, 0, 'LK', 'digital', '', ?, '', 'giftcard')`,
        )
        .run(reference, name, email, clean(i.phone, 40), quote.price, quote.price, i.method, quote.price, idem);
      const orderId = r.lastInsertRowid;
      await d.prepare("INSERT INTO order_items (order_id, sku, name, size, qty, unit_price, source, options, addon_price) VALUES (?,?,?,?,1,?, 'ready', '{}', 0)")
        .run(orderId, "GIFTCARD", `Gift card worth LKR ${quote.face.toLocaleString("en-LK")}`, "-", quote.price);
      await d.prepare("INSERT INTO gift_orders (order_id, face_value, recipient_name, sender_name, message) VALUES (?,?,?,?,?)")
        .run(orderId, quote.face, clean(i.recipientName, 100), name, clean(i.message, 300));
      await d.prepare("INSERT INTO order_events (order_id, stage, note, actor) VALUES (?,?,?,?)").run(orderId, "Awaiting payment", `Gift card LKR ${quote.face}, price LKR ${quote.price}`, "system");
      return { reference, email, payNow: quote.price };
    });
  } catch (e) {
    const err = e as { errno?: number; message?: string };
    if (err.errno === 1062 && String(err.message).includes("orders_idem")) return createGiftOrder(i);
    throw e;
  }
}

/**
 * Called inside the payment transaction, with the order row already locked, once a gift-card order is paid in full.
 * Issues the card exactly once (the gift_orders row is locked and its code is checked first), and completes the order.
 */
export async function issueGiftForOrderIn(d: Handle, order: { id: number; reference: string; kind?: string }): Promise<string | null> {
  if (order.kind !== "giftcard") return null;
  const g = (await d.prepare("SELECT face_value, code FROM gift_orders WHERE order_id = ? FOR UPDATE").get(order.id)) as { face_value: number; code: string } | undefined;
  if (!g) return null;
  if (g.code) return g.code;
  const cfg = await giftConfig(d);
  let code = newGiftCode();
  while (await d.prepare("SELECT 1 FROM store_credits WHERE code = ?").get(code)) code = newGiftCode();
  await d.prepare(
    `INSERT INTO store_credits (code, email, balance, issued, note, kind, expires_at, purchase_order_id)
     VALUES (?, '', ?, ?, ?, 'gift', DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MONTH), ?)`,
  ).run(code, g.face_value, g.face_value, `Gift card, order ${order.reference}`, cfg.validMonths, order.id);
  await d.prepare("INSERT INTO credit_ledger (code, delta, order_reference, note) VALUES (?,?,?, 'Gift card issued')").run(code, g.face_value, order.reference);
  await d.prepare("UPDATE gift_orders SET code = ? WHERE order_id = ?").run(code, order.id);
  await d.prepare("UPDATE orders SET stage = 'Delivered' WHERE id = ?").run(order.id);
  await d.prepare("INSERT INTO order_events (order_id, stage, note, actor) VALUES (?,?,?,?)").run(order.id, "Delivered", "Gift card issued", "system");
  return code;
}

/** A charged-back gift-card payment must not leave a spendable card behind. */
export async function voidGiftForOrderIn(d: Handle, orderId: number) {
  const g = (await d.prepare("SELECT code FROM gift_orders WHERE order_id = ? FOR UPDATE").get(orderId)) as { code: string } | undefined;
  if (!g?.code) return;
  const c = (await d.prepare("SELECT balance FROM store_credits WHERE code = ? FOR UPDATE").get(g.code)) as { balance: number } | undefined;
  if (!c || c.balance <= 0) return;
  await d.prepare("UPDATE store_credits SET balance = 0 WHERE code = ?").run(g.code);
  await d.prepare("INSERT INTO credit_ledger (code, delta, order_reference, note) VALUES (?,?,'', 'Voided: payment charged back')").run(g.code, -c.balance);
}

export type GiftView = { faceValue: number; recipientName: string; senderName: string; message: string; code: string; balance: number; expiresAt: string | null };
/** For the order page. Only call this after the order credential has been checked. */
export async function giftForOrder(orderId: number): Promise<GiftView | null> {
  const r = (await db()
    .prepare(
      `SELECT g.face_value, g.recipient_name, g.sender_name, g.message, g.code, c.balance, c.expires_at
       FROM gift_orders g LEFT JOIN store_credits c ON c.code = g.code AND g.code <> '' WHERE g.order_id = ?`,
    )
    .get(orderId)) as { face_value: number; recipient_name: string; sender_name: string; message: string; code: string; balance: number | null; expires_at: string | null } | undefined;
  if (!r) return null;
  return { faceValue: r.face_value, recipientName: r.recipient_name, senderName: r.sender_name, message: r.message, code: r.code, balance: r.balance ?? 0, expiresAt: r.expires_at };
}

/** Anyone holding the code may look at its balance. Rate-limit callers: this confirms whether a code exists. */
export async function giftBalance(rawCode: string): Promise<{ balance: number; expiresAt: string | null; expired: boolean; kind: string } | null> {
  const code = String(rawCode ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return null;
  const r = (await db().prepare("SELECT balance, expires_at, kind, (expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()) AS expired FROM store_credits WHERE code = ?").get(code)) as
    { balance: number; expires_at: string | null; kind: string; expired: number } | undefined;
  return r ? { balance: r.balance, expiresAt: r.expires_at, expired: !!Number(r.expired), kind: r.kind } : null;
}

export type GiftRow = { code: string; balance: number; issued: number; kind: string; expires_at: string | null; created_at: string; note: string };
export async function listGiftCards(): Promise<GiftRow[]> {
  return (await db().prepare("SELECT code, balance, issued, kind, expires_at, created_at, note FROM store_credits WHERE kind = 'gift' ORDER BY created_at DESC LIMIT 300").all()) as GiftRow[];
}
