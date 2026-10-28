import { headers } from "next/headers";
import { clientIp, limited } from "@/lib/ratelimit";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { db } from "@/lib/db";
import { formatLkr } from "@/lib/format";
import { amountToPay, balanceMethodAllowed, getOrder, orderKey, newPaymentAttempt, type PaymentRow } from "@/lib/orders";
import { buildCheckout, payhereConfig } from "@/lib/payhere";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay online", robots: { index: false } };

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ email?: string }> };

export default async function Pay({ params, searchParams }: Props) {
  const { reference } = await params;
  // Only FAILED lookups are limited (per address), so many customers behind one shared mobile connection are never blocked for viewing their own orders.
  const tooMany = async () => (await limited("page-miss:" + clientIp(await headers()), 30, 10 * 60 * 1000))
    ? (<PageShell title="Too many requests" narrow><p className="text-stone">Please wait a few minutes and try again.</p></PageShell>)
    : null;
  const { email = "" } = await searchParams;
  const parts = await getOrder(reference, email);
  if (!parts) {
    const blocked = await tooMany();
    if (blocked) return blocked;
    return (
      <PageShell title="Order not found" narrow>
        <p className="text-stone">We could not match that order and email. <Link className="underline" href="/track-order">Try tracking it</Link>.</p>
      </PageShell>
    );
  }
  const { order, items } = parts;
  const back = `/track-order/${order.reference}?email=${orderKey(order.reference, order.email)}`;
  const amount = amountToPay(order);
  if (amount <= 0 || order.stage === "Cancelled") redirect(back);
  if (!(await balanceMethodAllowed(order, "online"))) redirect(back);

  const cfg = payhereConfig();
  if (!cfg.configured) {
    return (
      <PageShell title="Online payment unavailable" narrow>
        
        <p className="text-stone">Online payment is not set up on this store yet. Your order {order.reference} is saved. You can pay by bank transfer from your tracking page.</p>
        <Link href={back} className="btn btn-primary mt-8">Go to my order</Link>
      </PageShell>
    );
  }

  // Reuse an open attempt for the same amount so refreshing this page does not pile up attempts.
  const open = (await db().prepare("SELECT * FROM payments WHERE order_id = ? AND provider = 'payhere' AND status = 'initiated' AND amount = ? ORDER BY id DESC LIMIT 1")
    .get(order.id, amount)) as PaymentRow | undefined;
  const payment = open ?? await newPaymentAttempt(order, "payhere", amount);
  const { action, fields } = buildCheckout(order, items, payment);

  return (
    <PageShell eyebrow={order.reference} title="Pay securely" narrow>
      
      <p className="text-stone">You will pay <strong className="text-ink">{formatLkr(amount)}</strong> on PayHere&apos;s secure page. Your order is only marked paid after PayHere confirms it to our server.</p>
      {!cfg.live && <p className="mt-4 border-l-2 border-accent bg-mist p-4 text-sm">Sandbox mode: no real money moves.</p>}
      <form method="post" action={action} className="mt-8">
        {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <button type="submit" className="btn btn-primary">Continue to PayHere</button>
      </form>
      <Link href={back} className="mt-6 inline-block text-sm underline text-stone">Pay later from my order page</Link>
    </PageShell>
  );
}
