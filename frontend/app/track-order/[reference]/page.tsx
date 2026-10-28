import { headers } from "next/headers";
import { clientIp, limited } from "@/lib/ratelimit";
import { Track3D } from "@/components/Track3D";
import { describeOptions, parseOptions } from "@/lib/options";
import type { Metadata } from "next";
import Link from "next/link";
import { ClearCartOnMount } from "@/components/CartProvider";
import { PageShell } from "@/components/PageShell";
import { BankProofForm, LookupForm } from "@/components/TrackForms";
import { BANK, bankConfigured } from "@/lib/config";
import { formatLkr } from "@/lib/format";
import { BALANCE_METHODS, amountToPay, enabledBalanceMethods, getOrder, orderKey } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { payhereConfig } from "@/lib/payhere";
import { giftForOrder } from "@/lib/gift";
import { CopyButton } from "@/components/CopyButton";
import { SITE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false } };

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ email?: string; new?: string; result?: string; submitted?: string }>;
};

const fmtDate = (s: string) => new Date(s.replace(" ", "T") + "Z").toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });

export default async function OrderPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const sp = await searchParams;
  // Only FAILED lookups are limited (per address), so many customers behind one shared mobile connection are never blocked for viewing their own orders.
  const tooMany = async () => (await limited("page-miss:" + clientIp(await headers()), 30, 10 * 60 * 1000))
    ? (<PageShell title="Too many requests" narrow><p className="text-stone">Please wait a few minutes and try again.</p></PageShell>)
    : null;
  const email = sp.email ?? "";
  const parts = email ? await getOrder(reference, email) : null;

  if (!parts) {
    const blocked = await tooMany();
    if (blocked) return blocked;
    return (
      <PageShell eyebrow="Pre-order tracking" title="Find your order" narrow>
        {email && <p className="mb-6 text-sm text-red-700">We could not match that reference and email.</p>}
        <LookupForm reference={reference.toUpperCase()} email={email} />
      </PageShell>
    );
  }

  const { order, items, events, payments, stages } = parts;
  const cancelled = order.stage === "Cancelled";
  const owed = cancelled ? 0 : amountToPay(order);
  const balance = order.total - order.paid_amount;
  const idx = stages.indexOf(order.stage);
  const awaiting = order.stage === "Awaiting payment";
  const submitted = payments.some((p) => p.provider === "bank" && p.status === "submitted");
  const pending = payhereConfig().configured;
  const st = await getSettings();
  const isBalance = !awaiting && order.payment_plan === "half" && owed > 0;
  const allowedBalance = enabledBalanceMethods(st.balance_methods);
  const onlineOk = pending && (!isBalance || allowedBalance.includes("online"));
  const bankOk = !isBalance || allowedBalance.includes("bank");
  const chosen = order.balance_method in BALANCE_METHODS ? BALANCE_METHODS[order.balance_method as keyof typeof BALANCE_METHODS] : "";
  const isGift = order.kind === "giftcard";
  const gift = isGift ? await giftForOrder(order.id) : null;
  const giftShare = gift?.code ? `https://wa.me/?text=${encodeURIComponent(`${gift.senderName ? `${gift.senderName} sent you` : "You have"} a SPORTIQ gift card worth LKR ${gift.faceValue.toLocaleString("en-LK")}${gift.message ? `: "${gift.message}"` : "."} Your code: ${gift.code}. Use it at checkout on ${SITE_URL}`)}` : "";
  const preItems = items.filter((i) => i.source === "preorder");
  const readyItems = items.filter((i) => i.source === "ready");

  return (
    <PageShell eyebrow={order.has_preorder ? "Pre-order tracking" : "Order tracking"} title={order.reference}>
      {(sp.new || sp.result === "return" || sp.submitted) && <ClearCartOnMount />}
      <div className="space-y-4">
        {sp.new && <Notice>Order placed. {order.payment_method === "bank" ? "Transfer the amount below, then submit your bank reference." : ""}</Notice>}
        {sp.result === "return" && <Notice>Thanks. We update this page when PayHere confirms your payment to our server. This can take a minute.</Notice>}
        {sp.result === "cancel" && <Notice>Payment was cancelled. Your order is still saved and you can pay below.</Notice>}
        {sp.submitted && <Notice>Bank reference received. Our team will verify it against the bank record.</Notice>}
        {cancelled && <Notice tone="warn">This order was cancelled. Reserved stock has been released.</Notice>}
      </div>

      {!cancelled && !isGift && (
        <section aria-label="Progress" className="mt-12">
          {awaiting ? (
            <p className="text-sm">Waiting for your {order.has_preorder && order.payment_plan === "half" ? "deposit" : "payment"}. Once it is confirmed, your order enters production tracking.</p>
          ) : (
            <Track3D stages={stages} current={idx} />
          )}
        </section>
      )}

      {isGift && !cancelled && (
        <section aria-label="Your gift card" className="mt-10">
          {gift?.code ? (
            <div className="grid gap-6 border border-ink bg-ink p-6 text-paper sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="eyebrow text-accent">Your gift card is ready</p>
                <p className="display mt-3 break-all text-4xl sm:text-6xl" aria-label={`Gift card code ${gift.code}`}>{gift.code}</p>
                <p className="mt-3 text-sm text-white/75">
                  Worth <strong className="text-paper">{formatLkr(gift.balance)}</strong>
                  {gift.balance !== gift.faceValue && <> (started at {formatLkr(gift.faceValue)})</>}
                  {gift.expiresAt && <> · valid until {new Date(gift.expiresAt.replace(" ", "T") + "Z").toLocaleDateString("en-LK", { dateStyle: "medium" })}</>}
                </p>
                {gift.recipientName && <p className="mt-2 text-sm text-white/75">For {gift.recipientName}</p>}
                {gift.message && <p className="mt-2 border-l-2 border-accent pl-3 text-sm text-white/90">{gift.message}</p>}
              </div>
              <div className="flex flex-wrap gap-3 md:flex-col">
                <CopyButton text={gift.code} />
                <a href={giftShare} target="_blank" rel="noreferrer" className="btn btn-primary !px-4 !py-2 text-xs">Send on WhatsApp</a>
              </div>
              <p className="text-xs text-white/60 md:col-span-2">To spend it, enter the code at checkout under “Gift card or store credit”. Keep this page safe: anyone with the code can spend it.</p>
            </div>
          ) : (
            <Notice>Your gift card code appears here as soon as your payment is confirmed. Bank transfers are confirmed by our team after you submit the reference.</Notice>
          )}
        </section>
      )}

      <div className="mt-16 grid gap-16 lg:grid-cols-2">
        <section>
          <h2 className="eyebrow">Items</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            {[...readyItems, ...preItems].map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-3">
                <span>{i.name} <span className="text-stone">· {i.size} × {i.qty}</span>
                  <span className={`eyebrow ml-2 px-1.5 py-0.5 ${i.source === "preorder" ? "bg-accent text-ink" : "bg-ink text-paper"}`}>{i.source === "preorder" ? "Pre-order" : "Ready"}</span>
                  {describeOptions(parseOptions(i.options)).map((d) => <span key={d} className="block text-xs text-stone">{d}</span>)}
                </span>
                <span className="font-semibold">{formatLkr((i.unit_price + i.addon_price) * i.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 text-sm">
            {(order.discount ?? 0) > 0 && <Row k={`Voucher ${order.voucher_code}`} v={`- ${formatLkr(order.discount ?? 0)}`} />}
            <Row k="Delivery" v={isGift ? "Digital: instant once paid" : `${order.delivery_method === "pickup" ? "Store pickup" : order.delivery_method === "international" ? "International postage" : "Delivery in Sri Lanka"}${order.shipping ? ` · ${formatLkr(order.shipping)}` : " · Free"}`} />
            <Row k="Total" v={formatLkr(order.total)} />
            <Row k="Paid so far" v={formatLkr(order.paid_amount)} />
            <Row k="Balance" v={formatLkr(Math.max(0, balance))} strong />
            {order.payment_plan === "half" && <Row k="Plan" v={order.delivery_method === "pickup" ? "Half now, balance in cash at pickup" : "Half now, balance in cash on delivery"} />}
          </dl>
        </section>

        <section>
          <h2 className="eyebrow">Payment</h2>
          {owed > 0 ? (
            <div className="mt-4">
              <p className="text-sm">
                {awaiting ? "Amount due now" : "Balance due"}: <strong>{formatLkr(owed)}</strong>
              </p>
              {order.payment_plan === "half" && (
                <p className="mt-2 text-sm text-stone">Deposit {formatLkr(order.due_now)} · Balance {formatLkr(order.total - order.due_now)}{chosen ? ` · You chose: ${chosen}` : ""}. {st.balance_note}</p>
              )}
              {awaiting && <p className="mt-2 text-sm text-stone">Closed the payment page or lost connection? Nothing is charged until your payment is confirmed. Open this page again to pay, or choose bank transfer below. Unpaid orders are released after a few hours.</p>}
              {isBalance && allowedBalance.some((m) => m.startsWith("cash")) && <p className="mt-2 text-sm text-stone">You can also pay the balance in cash when you collect or receive your order, where your chosen method allows it.</p>}
              {onlineOk && (
                <Link href={`/pay/${order.reference}?email=${orderKey(order.reference, order.email)}`} className="btn btn-primary mt-5">Pay online</Link>
              )}
              {bankOk && (order.payment_method === "bank" || !onlineOk || isBalance) ? (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold">Bank transfer</h3>
                  {bankConfigured() ? (
                    <dl className="mt-3 space-y-1 text-sm">
                      <Row k="Bank" v={`${BANK.name}${BANK.branch ? `, ${BANK.branch}` : ""}`} />
                      <Row k="Account name" v={BANK.accountName} />
                      <Row k="Account number" v={BANK.accountNumber} />
                      <Row k="Payment reference" v={order.reference} strong />
                    </dl>
                  ) : (
                    <p className="mt-3 border-l-2 border-accent bg-mist p-4 text-sm">Bank details are not published yet. Contact us with your order reference and we will send them.</p>
                  )}
                  {submitted ? <p className="mt-4 text-sm text-stone">Your bank reference is waiting for verification.</p> : <BankProofForm reference={order.reference} email={orderKey(order.reference, order.email)} amountLabel={formatLkr(owed)} />}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone">{cancelled ? "No payment is due." : "Nothing is due. Thank you."}</p>
          )}
          {payments.length > 0 && (
            <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 py-2.5">
                  <span>{p.provider === "bank" ? "Bank transfer" : p.provider === "cash" ? "Cash" : p.provider === "credit" ? "Store credit" : "Online"} · {formatLkr(p.amount)}</span>
                  <span className="text-stone">{p.status === "success" ? "Received" : p.status === "submitted" ? "Awaiting verification" : p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-16">
        <h2 className="eyebrow">History</h2>
        <ol className="mt-4 divide-y divide-line border-y border-line text-sm">
          {[...events].reverse().map((e, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
              <span><strong>{e.stage}</strong>{e.note && <span className="text-stone"> · {e.note}</span>}</span>
              <time className="text-stone">{fmtDate(e.created_at)}</time>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return <p role="status" className={`border-l-2 p-4 text-sm ${tone === "warn" ? "border-red-600 bg-red-50 text-red-800" : "border-accent bg-mist"}`}>{children}</p>;
}
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : "text-stone"}`}><dt>{k}</dt><dd className="text-right">{v}</dd></div>;
}
