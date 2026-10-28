"use client";

import { useEffect, useState } from "react";
import { quoteAction } from "@/app/actions";
import type { Quote } from "@/lib/orders";
import type { CartItem } from "./CartProvider";

export type Ship = { country: string; delivery: "delivery" | "pickup"; creditCode?: string; voucherCode?: string };

/** Prices the cart on the server. The browser never decides a price, an option charge, postage or a total. */
export function useQuote(items: CartItem[], plan: "full" | "half", ship: Ship = { country: "LK", delivery: "delivery" }) {
  const [result, setResult] = useState<{ quote: Quote | null; error: string | null; creditError: string | null; voucherError: string | null }>({ quote: null, error: null, creditError: null, voucherError: null });
  const key = JSON.stringify(items.map((i) => [i.sku, i.qty, i.options ?? null])) + plan + ship.country + ship.delivery + (ship.creditCode ?? "") + "|" + (ship.voucherCode ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    let live = true;
    quoteAction(items.map((i) => ({ sku: i.sku, qty: i.qty, options: i.options })), plan, ship.country, ship.delivery, ship.creditCode, ship.voucherCode).then((r) => {
      if (live) setResult({ quote: r.quote ?? null, error: r.error ?? null, creditError: r.creditError ?? null, voucherError: r.voucherError ?? null });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const empty = items.length === 0;
  const quote = empty ? null : result.quote;
  const error = empty ? null : result.error;
  return { quote, error, creditError: empty ? null : result.creditError, voucherError: empty ? null : result.voucherError, loading: !empty && !quote && !error };
}
