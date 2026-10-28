"use client";

import { useActionState } from "react";
import { bankProofAction, lookupOrderAction, type TrackState } from "@/app/track-order/actions";

export function LookupForm({ reference = "", email = "" }: { reference?: string; email?: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(lookupOrderAction, {});
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <label><span className="sr-only">Order reference</span><input name="reference" defaultValue={reference} required placeholder="Order reference (SIQ-XXXXXXXX)" className="field uppercase" /></label>
      <label><span className="sr-only">Email</span><input name="email" type="email" defaultValue={email} required placeholder="Email used at checkout" className="field" /></label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-primary w-fit" disabled={pending}>{pending ? "Looking…" : "Track order"}</button>
    </form>
  );
}

export function BankProofForm({ reference, email, amountLabel }: { reference: string; email: string; amountLabel: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(bankProofAction, {});
  return (
    <form action={action} className="mt-6 grid max-w-xl gap-4">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="email" value={email} />
      <p className="text-sm">After transferring <strong>{amountLabel}</strong>, enter the transaction reference from your bank receipt.</p>
      <label><span className="sr-only">Bank transaction reference</span><input name="bank_ref" required minLength={4} maxLength={60} placeholder="Bank transaction reference" className="field" /></label>
      <label className="grid gap-1 text-sm"><span>Photo of your bank receipt (optional, JPG/PNG/WebP, max 4 MB)</span><input name="proof" type="file" accept="image/jpeg,image/png,image/webp" className="field" /></label>
      <label><span className="sr-only">Note</span><input name="note" maxLength={300} placeholder="Note for our team (optional)" className="field" /></label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-primary w-fit" disabled={pending}>{pending ? "Sending…" : "Submit payment reference"}</button>
      <p className="text-xs text-stone">A reference is not proof of payment. Our team confirms it against the bank record.</p>
    </form>
  );
}
