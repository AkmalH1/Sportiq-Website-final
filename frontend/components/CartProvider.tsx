"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { optionKey, type ItemOptions } from "@/lib/options";

export type CartItem = { sku: string; qty: number; name: string; size: string; slug: string; options?: ItemOptions };

/** A cart line is the size plus its customisation, so two different customisations of one shirt stay separate. */
export const cartKey = (i: Pick<CartItem, "sku" | "options">) => i.sku + "|" + (i.options ? optionKey(i.options) : "");

type Ctx = {
  items: CartItem[];
  count: number;
  ready: boolean;
  add: (item: CartItem) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "siq-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  /* Reading localStorage must happen after mount to avoid a server/client mismatch. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.filter((i) => i && typeof i.sku === "string" && Number.isInteger(i.qty)));
      }
    } catch {}
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((cur) => {
      const k = cartKey(item);
      const found = cur.find((c) => cartKey(c) === k);
      if (found) return cur.map((c) => (cartKey(c) === k ? { ...c, qty: Math.min(10, c.qty + item.qty) } : c));
      return [...cur, { ...item, qty: Math.min(10, item.qty) }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setItems((cur) => cur.map((c) => (cartKey(c) === key ? { ...c, qty: Math.max(1, Math.min(10, qty)) } : c)));
  }, []);
  const remove = useCallback((key: string) => setItems((cur) => cur.filter((c) => cartKey(c) !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.reduce((s, i) => s + i.qty, 0), ready, add, setQty, remove, clear }),
    [items, ready, add, setQty, remove, clear],
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

export function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => clear(), [clear]);
  return null;
}
