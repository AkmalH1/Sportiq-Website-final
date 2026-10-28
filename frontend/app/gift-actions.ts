"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { GiftError, createGiftOrder, giftBalance } from "@/lib/gift";
import { orderKey } from "@/lib/orders";
import { payhereConfig } from "@/lib/payhere";
import { clientIp, limited } from "@/lib/ratelimit";

export type BuyGiftState = { error?: string; values?: Record<string, string> };

export async function buyGiftCardAction(_prev: BuyGiftState, fd: FormData): Promise<BuyGiftState> {
  const ip = clientIp(await headers());
  if (await limited("gift-order:" + ip, 10, 10 * 60 * 1000)) return { error: "Too many attempts from this connection. Please wait a few minutes." };
  const get = (k: string) => String(fd.get(k) ?? "");
  const values = Object.fromEntries(["name", "email", "phone", "recipient", "message", "amount"].map((k) => [k, get(k)]));
  const method = get("method") === "bank" ? "bank" : "payhere";
  if (method === "payhere" && !payhereConfig().configured) return { error: "Online payment is not available yet. Please choose bank transfer.", values };
  let result: { reference: string; email: string; payNow: number };
  try {
    result = await createGiftOrder({
      face: Number(get("amount")), name: get("name"), email: get("email"), phone: get("phone"),
      recipientName: get("recipient"), message: get("message"), method, idempotencyKey: get("idem"),
    });
  } catch (e) {
    if (e instanceof GiftError) return { error: e.message, values };
    console.error("createGiftOrder failed", e);
    return { error: "Something went wrong. Please try again.", values };
  }
  const q = `email=${orderKey(result.reference, result.email)}`;
  redirect(method === "payhere" ? `/pay/${result.reference}?${q}` : `/track-order/${result.reference}?${q}&new=1`);
}

export type BalanceState = { message?: string; ok?: boolean };

export async function checkGiftBalanceAction(_prev: BalanceState, fd: FormData): Promise<BalanceState> {
  // This confirms whether a code exists, so guessing is limited hard.
  if (await limited("gift-balance:" + clientIp(await headers()), 10, 15 * 60 * 1000)) return { message: "Too many attempts. Please wait 15 minutes." };
  const r = await giftBalance(String(fd.get("code") ?? ""));
  if (!r) return { message: "We could not find that code. Check it and try again." };
  const date = r.expiresAt ? new Date(r.expiresAt.replace(" ", "T") + "Z").toLocaleDateString("en-LK", { dateStyle: "medium" }) : "";
  if (r.expired) return { message: `This card expired on ${date}.` };
  if (r.balance <= 0) return { message: "This card has no balance left." };
  return { ok: true, message: `Balance: LKR ${r.balance.toLocaleString("en-LK")}${date ? `. Valid until ${date}.` : "."}` };
}
