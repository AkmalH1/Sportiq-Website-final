"use server";

import { redirect } from "next/navigation";
import { OrderError, createOrder, orderKey, quoteCart, type CartLineInput, type Quote } from "@/lib/orders";
import { payhereConfig } from "@/lib/payhere";
import { clientIp, limited } from "@/lib/ratelimit";
import { headers } from "next/headers";

export async function quoteAction(
  items: CartLineInput[], plan: "full" | "half", country: string, delivery: string, creditCode?: string, voucherCode?: string,
): Promise<{ quote?: Quote; error?: string; creditError?: string; voucherError?: string }> {
  if (!Array.isArray(items) || items.length === 0) return { error: "empty" };
  const ip = clientIp(await headers());
  if (await limited("quote:" + ip, 240, 10 * 60 * 1000)) return { error: "Too many price checks. Please wait a few minutes." };
  // Codes tell the caller whether they are valid, so guessing is limited much harder than ordinary pricing.
  if (creditCode && creditCode.trim() && (await limited("credit-guess:" + ip, 12, 15 * 60 * 1000))) return { error: "Too many store-credit attempts. Please wait 15 minutes." };
  if (voucherCode && voucherCode.trim() && (await limited("voucher-guess:" + ip, 30, 15 * 60 * 1000))) return { error: "Too many voucher attempts. Please wait 15 minutes." };
  const clean = items.map((i) => ({ sku: String(i.sku), qty: Number(i.qty), options: i.options }));
  const base = { items: clean, plan: plan === "half" ? ("half" as const) : ("full" as const), country: String(country || "LK"), delivery: String(delivery) };
  let credit = creditCode?.trim() ? creditCode : undefined;
  let voucher = voucherCode?.trim() ? voucherCode : undefined;
  let creditError: string | undefined;
  let voucherError: string | undefined;
  // A bad code never blocks the cart: drop it, say why next to its box, and price the cart without it.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return { quote: await quoteCart({ ...base, creditCode: credit, voucherCode: voucher }), creditError, voucherError };
    } catch (e) {
      const msg = e instanceof OrderError ? e.message : "";
      if (credit && msg.startsWith("That store credit")) { creditError = msg; credit = undefined; continue; }
      if (voucher && msg.startsWith("That voucher")) { voucherError = msg; voucher = undefined; continue; }
      return { error: msg || "We could not price your cart." };
    }
  }
  return { error: "We could not price your cart." };
}

export type PlaceOrderState = { error?: string; values?: Record<string, string> };

export async function placeOrderAction(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  if (await limited("order:" + clientIp(await headers()), 12, 10 * 60 * 1000)) return { error: "Too many orders from this connection. Please wait a few minutes." };
  let items: CartLineInput[] = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Your cart could not be read. Please refresh and try again." };
  }
  const method = String(formData.get("method")) === "bank" ? "bank" : "payhere";
  const get = (k: string) => String(formData.get(k) ?? "");
  // Echo what the customer typed so a failed attempt does not wipe the form.
  const values = Object.fromEntries(["name", "email", "phone", "address", "city", "postal"].map((k) => [k, get(k)]));
  if (method === "payhere" && !payhereConfig().configured && !get("credit_code").trim()) {
    return { error: "Online payment is not available yet. Please choose bank transfer.", values };
  }
  let result: { reference: string; email: string; payNow: number };
  try {
    result = await createOrder({
      items,
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      address: get("address"),
      city: get("city"),
      postal: get("postal"),
      country: get("country") || "LK",
      delivery: get("delivery"),
      method,
      plan: get("plan") === "half" ? "half" : "full",
      creditCode: get("credit_code"),
      voucherCode: get("voucher_code"),
      idempotencyKey: get("idem"),
      balanceMethod: get("balance_method"),
    });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message, values };
    console.error("createOrder failed", e);
    return { error: "Something went wrong while placing your order. Please try again.", values };
  }
  const q = `email=${orderKey(result.reference, result.email)}`;
  if (result.payNow === 0) redirect(`/track-order/${result.reference}?${q}&new=1`);
  redirect(method === "payhere" ? `/pay/${result.reference}?${q}` : `/track-order/${result.reference}?${q}&new=1`);
}
