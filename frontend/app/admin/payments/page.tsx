import { ExportLink } from "@/components/AdminUI";
import { Flash } from "@/components/AdminBits";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { formatLkr } from "@/lib/format";
import { listPayments } from "@/lib/ops";
import { RESOLUTIONS, listPartial, listRecon, paymentDashboard } from "@/lib/reconcile";
import { resolveReconAction } from "../ops-actions";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { overpayment: "Overpayment: refund the difference", late_payment: "Payment after cancellation", chargeback: "Chargeback", amount_mismatch: "Amount or currency mismatch" };

export default async function Payments({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [list, dash, recon, partial] = await Promise.all([listPayments(), paymentDashboard(), listRecon("open"), listPartial()]);
  const card = (label: string, n: number, amount: number, hint = "") => (
    <div className="border border-line p-4"><p className="eyebrow text-stone">{label}</p><p className="display mt-1 text-3xl">{n}</p><p className="text-sm text-stone">{formatLkr(amount)}{hint}</p></div>
  );
  return (
    <div>
      <div className="flex items-end justify-between gap-4"><h1 className="display text-5xl">Payments</h1><ExportLink kind="payments" /></div>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {card("Online: waiting (2 days)", dash.pendingOnline.n, dash.pendingOnline.amount)}
        {card("Online: verified", dash.verifiedOnline.n, dash.verifiedOnline.amount)}
        {card("Bank transfers to verify", dash.pendingBank.n, dash.pendingBank.amount)}
        {card("Partly paid orders", dash.partial.n, dash.partial.outstanding, " still owed")}
        {card("Failed / cancelled / rejected", dash.failedOrCancelled.n, dash.failedOrCancelled.amount)}
        {card("Needs your review", dash.openRecon.n, dash.openRecon.amount)}
      </div>

      <section className="mt-12">
        <h2 className="eyebrow">Refunds and exceptions to resolve ({recon.length})</h2>
        {recon.length === 0 ? <p className="mt-3 text-sm text-stone">Nothing waiting. Overpayments, payments after cancellation and chargebacks appear here.</p> : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {recon.map((r) => (
              <li key={r.id} className="py-4 text-sm">
                <p><strong>{KIND[r.kind] ?? r.kind}</strong> · {formatLkr(r.amount)} · <Link href={`/admin/orders/${r.reference}`} className="underline">{r.reference}</Link> <span className="text-xs text-stone">{r.created_at}</span></p>
                <p className="text-stone">{r.detail}</p>
                <form action={resolveReconAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="resolution" className="field w-64" aria-label="What was done" defaultValue="refunded">
                    {Object.entries(RESOLUTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input name="refund_ref" placeholder="Refund reference (if refunded)" className="field w-56" aria-label="Refund reference" maxLength={100} />
                  <input name="note" placeholder="Note" className="field w-56" aria-label="Note" maxLength={300} />
                  <button className="btn btn-ghost">Mark resolved</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-stone">The site does not send refunds. Refund through your bank or payment provider, then record the reference here. Original payment records are never edited.</p>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">Orders with a balance to collect ({partial.length})</h2>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-2 pr-4">Order</th><th className="pr-4">Customer</th><th className="pr-4">Paid</th><th className="pr-4">Still owed</th><th className="pr-4">Balance method</th><th>Stage</th></tr></thead>
          <tbody className="divide-y divide-line">
            {partial.map((o) => (
              <tr key={o.reference}><td className="py-2 pr-4"><Link href={`/admin/orders/${o.reference}`} className="underline">{o.reference}</Link></td><td className="pr-4">{o.customer_name}</td><td className="pr-4">{formatLkr(o.paid_amount)}</td><td className="pr-4">{formatLkr(o.total - o.paid_amount)}</td><td className="pr-4">{o.balance_method || "—"}</td><td>{o.stage}</td></tr>
            ))}
            {partial.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-stone">No outstanding balances.</td></tr>}
          </tbody></table></div>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">Ledger</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-3 pr-4">Date</th><th className="pr-4">Order</th><th className="pr-4">Customer</th><th className="pr-4">Method</th><th className="pr-4">Purpose</th><th className="pr-4">Amount</th><th className="pr-4">Verified by</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4 text-stone">{p.created_at}</td>
                  <td className="pr-4"><Link href={`/admin/orders/${p.reference}`} className="underline">{p.reference}</Link></td>
                  <td className="pr-4">{p.customer_name}</td><td className="pr-4">{p.provider}</td><td className="pr-4">{p.purpose}</td><td className="pr-4">{formatLkr(p.amount)}</td>
                  <td className="pr-4 text-stone">{p.verified_by ? `${p.verified_by} (${p.verification_source})` : "—"}</td><td>{p.status}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-stone">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
