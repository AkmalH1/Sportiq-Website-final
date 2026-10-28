import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { CheckoutForm } from "@/components/CheckoutForm";
import { randomUUID } from "node:crypto";
import { enabledBalanceMethods } from "@/lib/orders";
import { payhereConfig } from "@/lib/payhere";
import { getSettings, intSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout" };

export default async function Checkout() {
  const st = await getSettings();
  return (
    <PageShell eyebrow="Secure checkout" title="Checkout">
      <CheckoutForm payhereReady={payhereConfig().configured} localFee={intSetting(st, "local_delivery_fee", 500)} idem={randomUUID()}
        depositPercent={Math.min(100, Math.max(1, Number(st.deposit_percent) || 50))} balanceMethods={enabledBalanceMethods(st.balance_methods)} balanceNote={st.balance_note} />
    </PageShell>
  );
}
