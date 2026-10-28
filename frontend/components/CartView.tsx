"use client";

import Link from "next/link";
import { useCart, cartKey } from "./CartProvider";
import { useQuote } from "./useQuote";
import { QuoteLines } from "./QuoteLines";
import { EmptyState } from "./PageShell";
import { describeOptions } from "@/lib/options";

export function CartView() {
  const { items, ready, setQty, remove } = useCart();
  const { quote, error, loading } = useQuote(items, "full", { country: "LK", delivery: "pickup" });

  if (!ready) return <div className="h-40 animate-pulse bg-mist" aria-busy="true" />;
  if (items.length === 0) {
    return (
      <div>
        <EmptyState title="Your cart is empty" body="Pick a jersey and a size to get started." />
        <Link href="/shop" className="btn btn-primary mt-8">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((i) => {
          const k = cartKey(i);
          return (
            <li key={k} className="flex items-center justify-between gap-4 py-5">
              <div>
                <Link href={`/products/${i.slug}`} className="text-sm font-semibold uppercase tracking-wide hover:text-accent-dark">{i.name}</Link>
                <p className="mt-1 text-xs text-stone">Size {i.size}</p>
                {i.options && describeOptions(i.options).map((d) => <p key={d} className="text-xs text-stone">{d}</p>)}
                <button type="button" onClick={() => remove(k)} className="mt-2 text-xs underline text-stone hover:text-ink">Remove</button>
              </div>
              <div className="flex items-center border border-line" role="group" aria-label={`Quantity for ${i.name} ${i.size}`}>
                <button type="button" className="h-11 w-11" aria-label="Decrease quantity" onClick={() => setQty(k, i.qty - 1)}>−</button>
                <span className="w-7 text-center text-sm font-semibold">{i.qty}</span>
                <button type="button" className="h-11 w-11" aria-label="Increase quantity" onClick={() => setQty(k, i.qty + 1)}>+</button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside aria-live="polite">
        <h2 className="eyebrow">Order summary</h2>
        <div className="mt-4">
          {error && <p className="border-l-2 border-accent bg-mist p-4 text-sm">{error} Remove or change the item to continue.</p>}
          {!error && quote && (
            <>
              <QuoteLines quote={quote} hideDelivery />
              <p className="mt-3 text-xs text-stone">Delivery or postage is calculated at checkout. Store pickup is free.</p>
              <Link href="/checkout" className="btn btn-primary mt-8 w-full">Checkout</Link>
              <p className="mt-3 text-xs text-stone">Prices and stock are confirmed again when you place the order.</p>
            </>
          )}
          {!error && !quote && loading && <div className="h-32 animate-pulse bg-mist" aria-busy="true" />}
        </div>
      </aside>
    </div>
  );
}
