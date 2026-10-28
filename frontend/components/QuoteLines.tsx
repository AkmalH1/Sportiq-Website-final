import { formatLkr } from "@/lib/format";
import type { Quote } from "@/lib/orders";
import { describeOptions } from "@/lib/options";

export function QuoteLines({ quote, hideDelivery }: { quote: Quote; hideDelivery?: boolean }) {
  const pickup = quote.delivery.method === "pickup";
  return (
    <div>
      <ul className="divide-y divide-line border-y border-line text-sm">
        {quote.lines.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-3">
            <span>
              {l.name} <span className="text-stone">· {l.size} × {l.qty}</span>
              <span className={`eyebrow ml-2 px-1.5 py-0.5 ${l.source === "preorder" ? "bg-accent text-ink" : "bg-ink text-paper"}`}>
                {l.source === "preorder" ? "Pre-order" : "Ready"}
              </span>
              {l.addon > 0 && (
                <span className="mt-1 block text-xs text-stone">
                  {describeOptions(l.options).join(" · ")} (+{formatLkr(l.addon)} each)
                </span>
              )}
            </span>
            <span className="shrink-0 font-semibold">{formatLkr((l.price + l.addon) * l.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1.5 text-sm">
        <Row k="Subtotal" v={formatLkr(quote.subtotal)} />
        {quote.discount > 0 && <Row k={`Voucher ${quote.voucherCode}`} v={`- ${formatLkr(quote.discount)}`} accent />}
        {!hideDelivery && <Row k={quote.delivery.label} v={quote.shipping ? formatLkr(quote.shipping) : "Free"} />}
        {!hideDelivery && <Row k="Total" v={formatLkr(quote.total)} strong />}
        {!hideDelivery && quote.credit > 0 && <Row k="Store credit applied" v={`- ${formatLkr(quote.credit)}`} />}
        {!hideDelivery && quote.plan === "half" && (
          <>
            <Row k="Pay now" v={formatLkr(quote.payNow)} strong accent />
            <Row k={pickup ? "Balance, cash at pickup" : "Balance, cash on delivery"} v={formatLkr(quote.balance)} />
          </>
        )}
        {!hideDelivery && quote.plan === "full" && quote.credit > 0 && <Row k="Pay now" v={formatLkr(quote.payNow)} strong accent />}
      </dl>
      {!hideDelivery && <p className="mt-2 text-xs text-stone">{quote.delivery.days}</p>}
    </div>
  );
}

function Row({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : "text-stone"} ${accent ? "text-accent-dark" : ""}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
