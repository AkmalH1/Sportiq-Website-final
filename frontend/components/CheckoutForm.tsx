"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrderAction, type PlaceOrderState } from "@/app/actions";
import { COUNTRIES } from "@/lib/countries";
import { formatLkr } from "@/lib/format";
import type { BalanceMethod } from "@/lib/balance";
import { useCart } from "./CartProvider";
import { useQuote } from "./useQuote";
import { PlanChoice } from "./PlanChoice";
import { QuoteLines } from "./QuoteLines";
import { EmptyState } from "./PageShell";

export function CheckoutForm({ payhereReady, localFee, idem, depositPercent, balanceMethods, balanceNote }: {
  payhereReady: boolean; localFee: number; idem: string; depositPercent: number; balanceMethods: BalanceMethod[]; balanceNote: string;
}) {
  const { items, ready } = useCart();
  const [plan, setPlan] = useState<"full" | "half">("full");
  const [method, setMethod] = useState<"payhere" | "bank">(payhereReady ? "payhere" : "bank");
  const [country, setCountry] = useState("LK");
  const [delivery, setDelivery] = useState<"delivery" | "pickup">("delivery");
  const [balanceMethod, setBalanceMethod] = useState("");
  const [creditInput, setCreditInput] = useState("");
  const [credit, setCredit] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState("");
  const { quote, error, creditError, voucherError } = useQuote(items, plan, { country, delivery, creditCode: credit, voucherCode: voucher });
  const [state, action, pending] = useActionState<PlaceOrderState, FormData>(placeOrderAction, {});

  if (!ready) return <div className="h-40 animate-pulse bg-mist" aria-busy="true" />;
  if (items.length === 0) {
    return (
      <div>
        <EmptyState title="Your cart is empty" body="Add something before checking out." />
        <Link href="/shop" className="btn btn-primary mt-8">Shop now</Link>
      </div>
    );
  }

  const v = state.values ?? {};
  const balanceChoice = (balanceMethod === "cash_pickup" && !(country === "LK" && delivery === "pickup")) || (balanceMethod === "cash_delivery" && country === "LK" && delivery === "pickup") ? "" : balanceMethod;
  const local = country === "LK";
  const pickup = local && delivery === "pickup";
  const free = !!quote && quote.payNow === 0;
  const field = "field";
  return (
    <form action={action} className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ sku: i.sku, qty: i.qty, options: i.options })))} />
      <input type="hidden" name="plan" value={quote?.plan ?? plan} />
      <input type="hidden" name="idem" value={idem} />
      <input type="hidden" name="balance_method" value={balanceChoice} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="delivery" value={pickup ? "pickup" : "delivery"} />
      <input type="hidden" name="credit_code" value={credit && !creditError ? credit : ""} />
      <input type="hidden" name="voucher_code" value={voucher && !voucherError ? voucher : ""} />
      <div>
        <h2 className="eyebrow">Your details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="sr-only">Full name</span><input name="name" defaultValue={v.name} required autoComplete="name" placeholder="Full name" className={field} /></label>
          <label><span className="sr-only">Email</span><input name="email" defaultValue={v.email} type="email" required autoComplete="email" placeholder="Email" className={field} /></label>
          <label><span className="sr-only">Phone</span><input name="phone" defaultValue={v.phone} type="tel" required autoComplete="tel" placeholder="Phone / WhatsApp" className={field} /></label>
        </div>

        <h2 className="eyebrow mt-10">Where should we send it?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="sr-only">Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={field} autoComplete="country">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>

          {local && (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              {([
                ["delivery", "Delivery in Sri Lanka", `LKR ${localFee.toLocaleString("en-LK")}`],
                ["pickup", "Store pickup", "Free"],
              ] as const).map(([id, title, price]) => (
                <label key={id}>
                  <input type="radio" name="delivery_choice" checked={delivery === id} onChange={() => setDelivery(id)} className="peer sr-only" />
                  <span className="block cursor-pointer border border-line p-4 peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    <span className="flex justify-between text-sm font-semibold"><span>{title}</span><span>{price}</span></span>
                    <span className="mt-1 block text-xs text-stone">{id === "pickup" ? "Collect from our store once your order is ready." : "To your door anywhere in Sri Lanka."}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {!pickup && (
            <>
              <label className="sm:col-span-2"><span className="sr-only">Address</span><input name="address" defaultValue={v.address} required autoComplete="street-address" placeholder="Delivery address" className={field} /></label>
              <label><span className="sr-only">City</span><input name="city" defaultValue={v.city} required autoComplete="address-level2" placeholder="City" className={field} /></label>
              <label><span className="sr-only">Postal code</span><input name="postal" defaultValue={v.postal} required={!local} autoComplete="postal-code" placeholder={local ? "Postal code (optional)" : "Postal code"} className={field} /></label>
            </>
          )}
          {!local && <p className="text-xs text-stone sm:col-span-2">Postage is worked out from the weight of your parcel and your country. International orders are paid in full.</p>}
        </div>

        {!free && (
          <fieldset className="mt-10">
            <legend className="eyebrow">Payment method</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <input type="radio" name="method" value="payhere" disabled={!payhereReady} checked={method === "payhere"} onChange={() => setMethod("payhere")} className="peer sr-only" />
                <span className="block cursor-pointer border border-line p-4 peer-checked:border-ink peer-checked:bg-mist peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  <span className="text-sm font-semibold">Pay online</span>
                  <span className="mt-1 block text-xs text-stone">{payhereReady ? "Card payment through PayHere." : "Not set up yet on this store."}</span>
                </span>
              </label>
              <label>
                <input type="radio" name="method" value="bank" checked={method === "bank"} onChange={() => setMethod("bank")} className="peer sr-only" />
                <span className="block cursor-pointer border border-line p-4 peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  <span className="text-sm font-semibold">Bank transfer</span>
                  <span className="mt-1 block text-xs text-stone">Transfer, then enter your reference. We verify it before your order moves.</span>
                </span>
              </label>
            </div>
          </fieldset>
        )}
        {free && <input type="hidden" name="method" value="bank" />}

        <div className="mt-10">
          <h2 className="eyebrow">Voucher code</h2>
          <div className="mt-4 flex gap-2">
            <input value={voucherInput} onChange={(e) => setVoucherInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setVoucher(voucherInput.trim().toUpperCase()); } }} placeholder="Discount voucher code" className={field} aria-label="Discount voucher code" autoCapitalize="characters" autoComplete="off" />
            <button type="button" className="btn btn-ghost shrink-0" onClick={() => setVoucher(voucherInput.trim().toUpperCase())}>Apply</button>
          </div>
          {voucherError && <p role="alert" className="mt-2 text-xs text-red-700">{voucherError}</p>}
          {voucher && !voucherError && quote && quote.discount > 0 && (
            <p className="mt-2 text-xs text-stone">Voucher applied: you save {formatLkr(quote.discount)}. <button type="button" className="underline" onClick={() => { setVoucher(""); setVoucherInput(""); }}>Remove</button></p>
          )}
        </div>

        <div className="mt-8">
          <h2 className="eyebrow">Gift card or store credit</h2>
          <div className="mt-4 flex gap-2">
            <input value={creditInput} onChange={(e) => setCreditInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCredit(creditInput.trim().toUpperCase()); } }} placeholder="Gift card or store credit code" className={field} aria-label="Gift card or store credit code" autoCapitalize="characters" autoComplete="off" />
            <button type="button" className="btn btn-ghost shrink-0" onClick={() => setCredit(creditInput.trim().toUpperCase())}>Apply</button>
          </div>
          {creditError && <p role="alert" className="mt-2 text-xs text-red-700">{creditError}</p>}
          {credit && !creditError && quote && quote.credit > 0 && <p className="mt-2 text-xs text-stone">Applied: {formatLkr(quote.credit)} will be taken from your gift card or credit. Any balance stays on the card.</p>}
          <p className="mt-2 text-xs text-stone">No gift card yet? <Link href="/gift-cards" className="underline">Buy or check a gift card</Link>.</p>
        </div>
      </div>

      <aside aria-live="polite">
        <h2 className="eyebrow">Order summary</h2>
        <div className="mt-4">
          {error && <p className="border-l-2 border-accent bg-mist p-4 text-sm">{error} <Link href="/cart" className="underline">Back to cart</Link></p>}
          {!error && quote && (
            <>
              <QuoteLines quote={quote} />
              <PlanChoice quote={quote} plan={plan} onChange={setPlan} country={country} pickup={pickup} depositPercent={depositPercent} balanceMethods={balanceMethods} balanceNote={balanceNote} balanceMethod={balanceChoice} onBalanceMethod={setBalanceMethod} />
            </>
          )}
          {state.error && <p role="alert" className="mt-6 border-l-2 border-red-600 bg-red-50 p-4 text-sm text-red-800">{state.error}</p>}
          <button type="submit" disabled={pending || !!error || !quote || (quote?.plan === "half" && !balanceChoice)} className="btn btn-primary mt-8 w-full">
            {pending ? "Placing order…" : free ? "Place order" : method === "payhere" ? "Place order and pay" : "Place order"}
          </button>
          <p className="mt-3 text-xs text-stone">By ordering you confirm you understand our products are imported A-grade items, not official merchandise. <Link href="/disclaimer" className="underline">Copyright notice</Link>.</p>
          <p className="mt-3 text-xs text-stone">Nothing is marked paid until your payment is confirmed by our server or our team.</p>
        </div>
      </aside>
    </form>
  );
}
