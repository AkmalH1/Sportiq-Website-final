"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isCountry } from "@/lib/countries";
import { addExchange } from "@/lib/exchanges";
import { clientIp, limited } from "@/lib/ratelimit";
import { addReview } from "@/lib/reviews";
import { postage } from "@/lib/shipping";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };
const echo = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

export async function submitReviewAction(_p: FormState, fd: FormData): Promise<FormState> {
  if (String(fd.get("website") ?? "") !== "") return { ok: "Thank you. Your review will appear once our team approves it." }; // honeypot
  if (await limited("review:" + clientIp(await headers()), 4, 60 * 60 * 1000)) return { error: "Too many reviews from this connection. Please try again later." };
  try {
    await addReview({
      product: String(fd.get("product") ?? ""),
      name: String(fd.get("name") ?? ""),
      rating: Number(fd.get("rating")),
      body: String(fd.get("body") ?? ""),
      image: String(fd.get("image") ?? ""),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save your review.", values: echo(fd, ["name", "body"]) };
  }
  return { ok: "Thank you. Your review will appear once our team approves it." };
}

export async function submitExchangeAction(_p: FormState, fd: FormData): Promise<FormState> {
  if (String(fd.get("website") ?? "") !== "") return { ok: "Request sent." };
  if (await limited("exchange:" + clientIp(await headers()), 5, 60 * 60 * 1000)) return { error: "Too many requests from this connection. Please try again later." };
  try {
    await addExchange({
      reference: String(fd.get("reference") ?? ""),
      name: String(fd.get("name") ?? ""),
      contact: String(fd.get("contact") ?? ""),
      item: String(fd.get("item") ?? ""),
      reason: String(fd.get("reason") ?? ""),
      image: String(fd.get("image") ?? ""),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send your request.", values: echo(fd, ["name", "contact", "reference", "item", "reason"]) };
  }
  redirect("/returns?sent=1");
}

export async function postageAction(country: string, grams: number): Promise<{ fee?: number; days?: string; zone?: string; error?: string }> {
  if (!isCountry(country) || country === "LK") return { error: "Choose a country outside Sri Lanka." };
  const g = Math.max(1, Math.min(30000, Math.round(Number(grams) || 0)));
  let p;
  try {
    p = await postage(country, g);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not calculate postage." };
  }
  if (!p) return { error: "We cannot quote postage to that country yet. Message us on WhatsApp." };
  return { fee: p.fee, days: p.zone.days, zone: p.zone.name };
}

