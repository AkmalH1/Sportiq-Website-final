import "server-only";
import { payhereAmount, payhereConfig } from "./payhere";

/**
 * Independent server-to-server check of a PayHere payment, using PayHere's documented Retrieval API
 * (https://support.payhere.lk/api-&-mobile-sdk/retrieval-api):
 *   1. POST {base}/merchant/v1/oauth/token   Authorization: Basic base64(APP_ID:APP_SECRET)   body grant_type=client_credentials
 *   2. GET  {base}/merchant/v1/payment/search?order_id=...   Authorization: Bearer <token>
 * A payment is only credited when PayHere itself reports a matching payment with status RECEIVED.
 * The signed notification alone is no longer enough once the app credentials are configured (and in live mode they are required).
 *
 * Needs a "Business App" in the PayHere merchant portal (Settings > Domains & Credentials > API keys) with this server's domain allow-listed.
 */

export type Verification =
  | { state: "verified"; paymentId: string }
  | { state: "rejected"; reason: string }      // PayHere answered, and the payment is not (or not as expected) received
  | { state: "unavailable"; reason: string };  // could not get an answer: try again later, never credit on a guess

export const verifyConfigured = () => Boolean(process.env.PAYHERE_APP_ID && process.env.PAYHERE_APP_SECRET);

/** Test hook: a non-live deployment may point the API calls at a local mock. Ignored in live mode so it can never redirect real traffic. */
function apiBase(): string {
  const cfg = payhereConfig();
  const override = process.env.PAYHERE_API_BASE;
  if (override && !cfg.live) return override.replace(/\/$/, "");
  return cfg.live ? "https://www.payhere.lk" : "https://sandbox.payhere.lk";
}

let cached: { token: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now() + 15_000) return cached.token;
  const basic = Buffer.from(`${process.env.PAYHERE_APP_ID}:${process.env.PAYHERE_APP_SECRET}`).toString("base64");
  const res = await fetch(`${apiBase()}/merchant/v1/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("token missing in response");
  cached = { token: j.access_token, until: Date.now() + (j.expires_in ?? 300) * 1000 };
  return j.access_token;
}

type Entry = { payment_id?: string | number; order_id?: string; status?: string; currency?: string; amount?: string | number };

/**
 * @param orderId   the order_id we sent to PayHere (payments.provider_order_id)
 * @param amount    the server-calculated amount we expect (LKR, whole rupees)
 * @param notifiedPaymentId  the payment_id in the signed notification, which must be one of the payments PayHere lists
 */
export async function verifyPayHerePayment(orderId: string, amount: number, currency: string, notifiedPaymentId: string): Promise<Verification> {
  if (!verifyConfigured()) return { state: "unavailable", reason: "PAYHERE_APP_ID / PAYHERE_APP_SECRET not set" };
  try {
    let res = await fetch(`${apiBase()}/merchant/v1/payment/search?order_id=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) { // token expired early: get a new one once
      cached = null;
      res = await fetch(`${apiBase()}/merchant/v1/payment/search?order_id=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
    }
    if (res.status >= 500 || res.status === 429) return { state: "unavailable", reason: `PayHere HTTP ${res.status}` };
    if (res.status === 401 || res.status === 403) return { state: "unavailable", reason: "PayHere refused the app credentials or domain" };
    const j = (await res.json()) as { status?: number; data?: Entry[] };
    const list = Array.isArray(j.data) ? j.data : [];
    if (list.length === 0) return { state: "rejected", reason: "PayHere has no payment for this order" };
    const want = payhereAmount(amount);
    const mine = list.filter((e) => String(e.order_id ?? orderId) === orderId);
    const match = mine.find((e) => String(e.payment_id ?? "") === notifiedPaymentId && notifiedPaymentId !== "");
    if (!match) return { state: "rejected", reason: "payment_id in the notification is not among PayHere's records" };
    if (String(match.status ?? "").toUpperCase() !== "RECEIVED") return { state: "rejected", reason: `PayHere status is ${match.status ?? "unknown"}` };
    if (String(match.currency ?? "") !== currency) return { state: "rejected", reason: "currency differs from PayHere's record" };
    if (Number(match.amount).toFixed(2) !== want) return { state: "rejected", reason: `amount differs: PayHere ${match.amount}, expected ${want}` };
    return { state: "verified", paymentId: String(match.payment_id) };
  } catch (e) {
    return { state: "unavailable", reason: e instanceof Error ? e.message.slice(0, 120) : "lookup failed" };
  }
}
