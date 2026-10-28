"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { buyGiftCardAction, checkGiftBalanceAction, type BalanceState, type BuyGiftState } from "@/app/gift-actions";
import { GIFT_MAX, GIFT_MIN, giftPrice, type GiftTier } from "@/lib/promo-logic";
import { formatLkr } from "@/lib/format";

export function GiftCardForm({ tiers, payhereReady, idem }: { tiers: GiftTier[]; payhereReady: boolean; idem: string }) {
  const [state, action, pending] = useActionState<BuyGiftState, FormData>(buyGiftCardAction, {});
  const v = state.values ?? {};
  const presets = tiers.length ? tiers.map((t) => t.face) : [5000, 10000, 25000];
  const [amount, setAmount] = useState<number>(Number(v.amount) || presets[Math.min(1, presets.length - 1)]);
  const [custom, setCustom] = useState(false);
  const [method, setMethod] = useState<"payhere" | "bank">(payhereReady ? "payhere" : "bank");
  const quote = useMemo(() => giftPrice(amount, tiers), [amount, tiers]);
  const id = useId();
  const field = "field";

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <input type="hidden" name="idem" value={idem} />
      <input type="hidden" name="amount" value={quote ? amount : ""} />
      <div>
        <fieldset>
          <legend className="eyebrow">1. Choose an amount</legend>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {presets.map((face) => {
              const q = giftPrice(face, tiers);
              const on = !custom && amount === face;
              return (
                <label key={face}>
                  <input type="radio" name={`${id}-preset`} checked={on} onChange={() => { setCustom(false); setAmount(face); }} className="peer sr-only" />
                  <span className="block cursor-pointer border border-line p-4 text-center peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    <span className="display block text-3xl">{formatLkr(face)}</span>
                    {q && q.percent > 0 ? <span className="eyebrow mt-2 block bg-accent px-2 py-1 text-ink">Save {q.percent}%</span> : <span className="mt-2 block text-xs text-stone">Gift card</span>}
                  </span>
                </label>
              );
            })}
            <label className={custom ? "col-span-2 sm:col-span-3" : ""}>
              {custom ? (
                <span className="flex items-center gap-3">
                  <input type="number" inputMode="numeric" min={GIFT_MIN} max={GIFT_MAX} step={100} value={amount || ""} onChange={(e) => setAmount(Math.round(Number(e.target.value)))} aria-label="Custom gift card amount in LKR" className={field} autoFocus />
                  <span className="text-xs text-stone">LKR {GIFT_MIN.toLocaleString("en-LK")} to {GIFT_MAX.toLocaleString("en-LK")}</span>
                </span>
              ) : (
                <button type="button" onClick={() => setCustom(true)} className="block h-full min-h-24 w-full border border-dashed border-line p-4 text-center text-sm hover:border-ink">Other amount</button>
              )}
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-10">
          <legend className="eyebrow">2. Who is it for?</legend>
          <div className="mt-4 grid gap-4">
            <input name="recipient" defaultValue={v.recipient} maxLength={100} placeholder="Recipient's name (optional)" className={field} aria-label="Recipient name" />
            <textarea name="message" defaultValue={v.message} maxLength={300} rows={3} placeholder="Your message (optional, up to 300 characters)" className={field} aria-label="Gift message" />
          </div>
        </fieldset>

        <fieldset className="mt-10">
          <legend className="eyebrow">3. Your details</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input name="name" defaultValue={v.name} required autoComplete="name" placeholder="Your full name" className={`${field} sm:col-span-2`} aria-label="Your full name" />
            <input name="email" type="email" defaultValue={v.email} required autoComplete="email" placeholder="Your email" className={field} aria-label="Your email" />
            <input name="phone" type="tel" defaultValue={v.phone} required autoComplete="tel" placeholder="Phone / WhatsApp" className={field} aria-label="Phone or WhatsApp" />
          </div>
        </fieldset>
      </div>

      <aside aria-live="polite">
        <h2 className="eyebrow">Summary</h2>
        <div className="mt-4 border border-line p-5">
          {quote ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-stone"><dt>Gift card value</dt><dd>{formatLkr(quote.face)}</dd></div>
              {quote.saving > 0 && <div className="flex justify-between text-accent-dark"><dt>Gift card offer ({quote.percent}% off)</dt><dd>- {formatLkr(quote.saving)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>You pay</dt><dd>{formatLkr(quote.price)}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-stone">Enter an amount between {formatLkr(GIFT_MIN)} and {formatLkr(GIFT_MAX)}.</p>
          )}
        </div>

        <fieldset className="mt-8">
          <legend className="eyebrow">Payment</legend>
          <div className="mt-4 grid gap-3">
            <label>
              <input type="radio" name="method" value="payhere" disabled={!payhereReady} checked={method === "payhere"} onChange={() => setMethod("payhere")} className="peer sr-only" />
              <span className="block cursor-pointer border border-line p-4 peer-checked:border-ink peer-checked:bg-mist peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                <span className="text-sm font-semibold">Pay online</span>
                <span className="mt-1 block text-xs text-stone">{payhereReady ? "Card payment through PayHere. Your code appears as soon as it is confirmed." : "Not set up yet on this store."}</span>
              </span>
            </label>
            <label>
              <input type="radio" name="method" value="bank" checked={method === "bank"} onChange={() => setMethod("bank")} className="peer sr-only" />
              <span className="block cursor-pointer border border-line p-4 peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                <span className="text-sm font-semibold">Bank transfer</span>
                <span className="mt-1 block text-xs text-stone">Transfer, then enter your reference. Your code appears once our team verifies it.</span>
              </span>
            </label>
          </div>
        </fieldset>

        {state.error && <p role="alert" className="mt-6 border-l-2 border-red-600 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>}
        <button type="submit" disabled={pending || !quote} className="btn btn-primary mt-8 w-full">{pending ? "Please wait…" : method === "payhere" ? "Continue to payment" : "Place gift card order"}</button>
        <p className="mt-3 text-xs text-stone">Nothing is issued until your payment is confirmed by our server or our team.</p>
      </aside>
    </form>
  );
}

export function GiftBalanceForm() {
  const [state, action, pending] = useActionState<BalanceState, FormData>(checkGiftBalanceAction, {});
  return (
    <form action={action} className="max-w-xl">
      <div className="flex gap-2">
        <input name="code" required placeholder="GC-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" className="field" aria-label="Gift card code" />
        <button className="btn btn-ghost shrink-0" disabled={pending}>{pending ? "Checking…" : "Check"}</button>
      </div>
      {state.message && <p role="status" className={`mt-3 text-sm ${state.ok ? "font-semibold" : "text-stone"}`}>{state.message}</p>}
    </form>
  );
}
