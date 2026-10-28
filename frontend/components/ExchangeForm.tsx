"use client";

import { useActionState } from "react";
import { submitExchangeAction, type FormState } from "@/app/public-actions";
import { ImagePicker } from "./ImagePicker";

export function ExchangeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitExchangeAction, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <input name="name" defaultValue={v.name} required placeholder="Your name" className="field" aria-label="Your name" />
      <input name="contact" defaultValue={v.contact} required placeholder="WhatsApp number or email" className="field" aria-label="WhatsApp number or email" />
      <input name="reference" defaultValue={v.reference} placeholder="Order reference (e.g. SIQ-ABCD2345)" className="field" aria-label="Order reference" />
      <input name="item" defaultValue={v.item} placeholder="Which item? (name and size)" className="field" aria-label="Item" />
      <textarea name="reason" defaultValue={v.reason} required rows={4} placeholder="Why do you want to exchange it? What size or item would you like instead?" className="field" aria-label="Reason" />
      <ImagePicker name="image" label="Add a photo of the item (optional)" />
      {state.error && <p role="alert" className="border-l-2 border-red-600 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary w-fit">{pending ? "Sending…" : "Send exchange request"}</button>
    </form>
  );
}
