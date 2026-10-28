"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OrderError, getOrder, orderKey, submitBankProof } from "@/lib/orders";
import { clientIp, limited } from "@/lib/ratelimit";
import { savePrivateProof } from "@/lib/upload";

export type TrackState = { error?: string };

export async function lookupOrderAction(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const ref = String(fd.get("reference") ?? "").trim().toUpperCase();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^SIQ-[A-Z0-9]{8}$/.test(ref)) return { error: "Enter your order reference, like SIQ-ABCD2345." };
  if (!email.includes("@")) return { error: "Enter the email you used at checkout." };
  if (await limited("lookup:" + clientIp(await headers()), 20, 10 * 60 * 1000)) return { error: "Too many attempts. Please wait a few minutes." };
  if (!await getOrder(ref, email)) return { error: "We could not match that reference and email." };
  redirect(`/track-order/${ref}?email=${orderKey(ref, email)}`);
}

export async function bankProofAction(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const ref = String(fd.get("reference") ?? "");
  const email = String(fd.get("email") ?? "");
  if (await limited("proof:" + clientIp(await headers()), 10, 10 * 60 * 1000)) return { error: "Too many attempts. Please wait a few minutes." };
  try {
    const f = fd.get("proof");
    // Optional receipt photo: kept private, only staff can open it. It is never treated as proof of payment by itself.
    const proofFile = f instanceof File && f.size > 0 ? await savePrivateProof(f) : null;
    await submitBankProof(ref, email, String(fd.get("bank_ref") ?? ""), String(fd.get("note") ?? ""), proofFile);
  } catch (e) {
    if (e instanceof OrderError || (e instanceof Error && /image|MB|JPG/.test(e.message))) return { error: (e as Error).message };
    console.error("bank proof failed", e);
    return { error: "Something went wrong. Please try again." };
  }
  // Never put the customer's email in a URL: use the signed order key (or keep the key they already came with).
  const key = email.startsWith("t_") ? email : orderKey(ref.trim().toUpperCase(), email);
  redirect(`/track-order/${ref}?email=${key}&submitted=1`);
}
