import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = { title: "Cart" };

export default function Cart() {
  return (
    <PageShell title="Your cart">
      <CartView />
    </PageShell>
  );
}
