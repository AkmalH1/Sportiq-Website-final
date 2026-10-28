import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "./config";
import { countryName } from "./countries";
import type { OrderItemRow, OrderRow } from "./types";
import { orderKey, type PaymentRow } from "./orders";

const md5Upper = (s: string) => createHash("md5").update(s).digest("hex").toUpperCase();

export function payhereConfig() {
  const merchantId = process.env.PAYHERE_MERCHANT_ID ?? "";
  const secret = process.env.PAYHERE_MERCHANT_SECRET ?? "";
  const live = process.env.PAYHERE_MODE === "live";
  // In production the mode must be stated ("live" or "sandbox"). A forgotten value must not silently mean sandbox.
  const modeStated = process.env.NODE_ENV !== "production" || ["live", "sandbox"].includes(process.env.PAYHERE_MODE ?? "");
  return {
    // In live mode the independent status check (Retrieval API credentials) is mandatory, so card payments stay off until it is set.
    configured: Boolean(modeStated && merchantId && secret && (!live || (process.env.PAYHERE_APP_ID && process.env.PAYHERE_APP_SECRET))),
    merchantId,
    secret,
    live,
    url: live ? "https://www.payhere.lk/pay/checkout" : "https://sandbox.payhere.lk/pay/checkout",
  };
}

/** Amount as PayHere requires: two decimals, dot separator, no thousands separator. */
export const payhereAmount = (lkr: number) => lkr.toFixed(2);

export function requestHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string) {
  return md5Upper(merchantId + orderId + amount + currency + md5Upper(secret));
}

export function notifySignature(p: {
  merchant_id: string; order_id: string; payhere_amount: string; payhere_currency: string; status_code: string;
}, secret: string) {
  return md5Upper(p.merchant_id + p.order_id + p.payhere_amount + p.payhere_currency + p.status_code + md5Upper(secret));
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The callback address PayHere posts to. PAYHERE_NOTIFY_HOST (optional) moves it to its own hostname; otherwise the public site address. */
export function notifyUrl(siteUrl: string = SITE_URL, notifyHost: string | undefined = process.env.PAYHERE_NOTIFY_HOST): string {
  const h = (notifyHost || "").trim();
  if (!h) return `${siteUrl}/api/payhere/notify`;
  return `https://${h}/api/payhere/notify`;
}

/** Build the form fields the browser posts to PayHere. The hash is computed here, on the server. */
export function buildCheckout(order: OrderRow, items: OrderItemRow[], payment: PaymentRow) {
  const cfg = payhereConfig();
  if (!cfg.configured) throw new Error("PayHere is not configured");
  const amount = payhereAmount(payment.amount);
  const [first, ...rest] = order.customer_name.split(" ");
  const back = `${SITE_URL}/track-order/${order.reference}?email=${orderKey(order.reference, order.email)}`;
  const fields: Record<string, string> = {
    merchant_id: cfg.merchantId,
    return_url: `${back}&result=return`,
    cancel_url: `${back}&result=cancel`,
    notify_url: notifyUrl(),
    order_id: payment.provider_order_id,
    items: items.map((i) => `${i.name} (${i.size}) x${i.qty}`).join(", ").slice(0, 250),
    currency: payment.currency,
    amount,
    first_name: first,
    last_name: rest.join(" ") || "-",
    email: order.email,
    phone: order.phone,
    address: order.address,
    city: order.city,
    country: countryName(order.country) || "Sri Lanka",
    custom_1: order.reference,
    hash: requestHash(cfg.merchantId, payment.provider_order_id, amount, payment.currency, cfg.secret),
  };
  return { action: cfg.url, fields };
}
