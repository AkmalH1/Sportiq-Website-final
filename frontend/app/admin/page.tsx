import Link from "next/link";
import { Flash } from "@/components/AdminBits";
import { ExportLink, Stat } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { bankConfigured } from "@/lib/config";
import { db } from "@/lib/db";
import { formatLkr } from "@/lib/format";
import { dashboard, listBatches } from "@/lib/ops";
import { listOrders, releaseExpired } from "@/lib/orders";
import { payhereConfig } from "@/lib/payhere";
import { pendingReviewCount } from "@/lib/reviews";
import { assignOrdersAction, bulkStageAction } from "./ops-actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string; q?: string; ok?: string; err?: string }> };

const ALL_STAGES = ["Confirmed", "Supplier Paid", "Production", "Shipping", "Arrived in Sri Lanka", "Out for Delivery", "Ready for Pickup", "Posted", "Delivered", "Collected"];

export default async function AdminOrders({ searchParams }: Props) {
  await requireAdmin();
  await releaseExpired();
  const { status = "", q = "", ok, err } = await searchParams;
  const orders = await listOrders({ status: status || undefined, q: q.trim() || undefined });
  const count = async (sql: string) => ((await db().prepare(sql).get()) as { n: number }).n;
  const toVerify = await count("SELECT COUNT(*) AS n FROM payments WHERE provider='bank' AND status='submitted'");
  const lowStock = await count("SELECT COUNT(*) AS n FROM variants v JOIN products p ON p.id=v.product_id WHERE p.status='published' AND p.preorder_enabled=0 AND v.stock BETWEEN 1 AND 2");
  const exchangesNew = await count("SELECT COUNT(*) AS n FROM exchange_requests WHERE status = 'new'");
  const d = await dashboard();
  const batches = await listBatches();
  const back = `/admin${q || status ? `?q=${encodeURIComponent(q)}&status=${status}` : ""}`;

  return (
    <div>
      <h1 className="display text-5xl">Dashboard</h1>
      <div className="mt-6"><Flash ok={ok} err={err} /></div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active orders" value={d.orders} />
        <Stat label="Money received" value={formatLkr(d.received)} />
        <Stat label="Balances owed (cash on delivery)" value={formatLkr(d.owing)} />
        <Stat label="Owed to suppliers" value={formatLkr(d.supplierDue)} sub={`Paid so far ${formatLkr(d.supplierPaid)}`} />
      </ul>
      <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Bank payments to verify" value={toVerify} />
        <Stat label="Reviews waiting" value={await pendingReviewCount()} />
        <Stat label="New exchange requests" value={exchangesNew} />
        <Stat label="Pre-orders not in a batch" value={d.unbatched} />
      </ul>
      <p className="mt-4 text-xs text-stone">Ready-stock sizes almost out: {lowStock} · Expenses logged: {formatLkr(d.expenses)}</p>

      <h2 className="eyebrow mt-10">Orders by stage</h2>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {Object.entries(d.stages).map(([s, n]) => <li key={s} className="border border-line px-3 py-1.5">{s}: <strong>{n}</strong></li>)}
      </ul>

      <ul className="mt-6 space-y-2 text-sm">
        {!payhereConfig().configured && <li className="border-l-2 border-accent bg-mist p-3">PayHere is not configured. Online payment is disabled until PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET are set.</li>}
        {!bankConfigured() && <li className="border-l-2 border-accent bg-mist p-3">Bank details are not configured. Set BANK_NAME, BANK_ACCOUNT_NAME and BANK_ACCOUNT_NUMBER before taking bank transfers.</li>}
      </ul>

      <h2 className="display mt-14 text-4xl">Orders</h2>
      <form className="mt-4 flex flex-wrap gap-3" role="search">
        <input name="q" defaultValue={q} placeholder="Reference, name, email, phone" className="field max-w-xs" aria-label="Search orders" />
        <select name="status" defaultValue={status} className="field max-w-[12rem]" aria-label="Payment status">
          <option value="">All payments</option>
          {["pending", "partial", "paid", "failed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost">Filter</button>
        <ExportLink kind="orders" />
      </form>

      <form className="mt-6">
        <input type="hidden" name="back" value={back} />
        <div className="flex flex-wrap items-end gap-3 border border-line bg-mist p-4">
          <p className="eyebrow w-full text-stone">With the ticked orders</p>
          <select name="batch_id" className="field max-w-[14rem]" aria-label="Batch">
            <option value="0">No batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button formAction={assignOrdersAction} className="btn btn-ghost">Put in batch</button>
          <select name="stage" className="field max-w-[14rem]" aria-label="Stage">
            <option value="">Choose stage</option>
            {ALL_STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input name="note" placeholder="Note (optional)" className="field max-w-[14rem]" aria-label="Note" />
          <button formAction={bulkStageAction} className="btn btn-primary">Move to stage</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="eyebrow border-b border-line text-stone">
              <tr><th className="w-8 py-3"><span className="sr-only">Select</span></th><th className="pr-4">Reference</th><th className="pr-4">Customer</th><th className="pr-4">Total</th><th className="pr-4">Paid</th><th className="pr-4">Payment</th><th className="pr-4">Stage</th><th>Type</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="py-3"><input type="checkbox" name="ref" value={o.reference} aria-label={`Select ${o.reference}`} /></td>
                  <td className="pr-4"><Link href={`/admin/orders/${o.reference}`} className="font-semibold underline">{o.reference}</Link><div className="text-xs text-stone">{o.created_at}</div></td>
                  <td className="pr-4">{o.customer_name}<div className="text-xs text-stone">{o.email}</div></td>
                  <td className="pr-4">{formatLkr(o.total)}<div className="text-xs text-stone">{o.country}{o.delivery_method === "pickup" ? " · pickup" : ""}</div></td>
                  <td className="pr-4">{formatLkr(o.paid_amount)}</td>
                  <td className="pr-4">{o.payment_status}<div className="text-xs text-stone">{o.payment_method}{o.payment_plan === "half" ? ", half (COD balance)" : ""}</div></td>
                  <td className="pr-4">{o.stage}{o.batch_id ? <div className="text-xs text-stone">batch #{o.batch_id}</div> : null}</td>
                  <td>{o.has_preorder ? "Pre-order" : "Ready"}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-stone">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
