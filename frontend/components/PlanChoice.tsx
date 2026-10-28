import { formatLkr } from "@/lib/format";
import { BALANCE_METHODS, type BalanceMethod } from "@/lib/balance";
import type { Quote } from "@/lib/orders";

type Props = {
  quote: Quote; plan: "full" | "half"; onChange: (p: "full" | "half") => void; country: string; pickup: boolean;
  depositPercent: number; balanceMethods: BalanceMethod[]; balanceNote: string; balanceMethod: string; onBalanceMethod: (m: string) => void;
};

/** Full vs half payment, shown only for pre-orders to Sri Lanka. Only the balance methods staff enabled are offered. */
export function PlanChoice({ quote, plan, onChange, country, pickup, depositPercent, balanceMethods, balanceNote, balanceMethod, onBalanceMethod }: Props) {
  if (!quote.hasPre) return null;
  if (country !== "LK") {
    return <p className="mt-8 border-l-2 border-accent bg-mist p-4 text-sm">Pre-orders shipped abroad are paid in full before we order them in.</p>;
  }
  const methods = balanceMethods.filter((m) => (m === "cash_pickup" ? pickup : m === "cash_delivery" ? !pickup : true));
  const full = quote.total;
  // The server works out the deposit for the discounted items; the browser never does its own sum.
  const half = quote.dueIfHalf;
  const opts: { id: "full" | "half"; title: string; amount: number; text: string; tag?: string }[] = [
    { id: "full", title: "Pay in full", amount: full, text: "Settle everything now. This is the easiest for us and gets your pre-order moving.", tag: "Recommended" },
  ];
  // Half payment is offered only when staff have enabled at least one way to collect the balance.
  if (methods.length > 0) {
    opts.push({ id: "half", title: "Pay a deposit now", amount: half, text: `${depositPercent}% of the pre-order items now (ready-stock items and postage in full). The remaining ${formatLkr(full - half)} is paid later.` });
  }
  return (
    <fieldset className="mt-8">
      <legend className="eyebrow">Pre-order payment</legend>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {opts.map((o) => (
          <label key={o.id}>
            <input type="radio" name="plan_choice" value={o.id} checked={plan === o.id} onChange={() => onChange(o.id)} className="peer sr-only" />
            <span className="block h-full cursor-pointer border border-line p-4 peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{o.title}{o.tag && <span className="eyebrow ml-2 bg-accent px-1.5 py-0.5 text-ink">{o.tag}</span>}</span>
                <span className="text-sm font-semibold">{formatLkr(o.amount)}</span>
              </span>
              <span className="mt-1 block text-xs text-stone">{o.text}</span>
            </span>
          </label>
        ))}
      </div>
      {plan === "half" && quote.plan === "half" && (
        <div className="mt-4 border border-line p-4">
          <p className="text-sm font-semibold">How will you pay the remaining {formatLkr(quote.balance)}?</p>
          <div className="mt-3 grid gap-2">
            {methods.map((m) => (
              <label key={m} className="flex items-center gap-3 text-sm">
                <input type="radio" name="balance_choice" value={m} checked={balanceMethod === m} onChange={() => onBalanceMethod(m)} /> {BALANCE_METHODS[m]}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone">{balanceNote}</p>
        </div>
      )}
    </fieldset>
  );
}
