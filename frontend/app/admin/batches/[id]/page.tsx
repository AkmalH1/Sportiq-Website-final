import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/AdminBits";
import { AField, Stat } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { formatLkr } from "@/lib/format";
import { BATCH_STAGES, getBatch, listDealers } from "@/lib/ops";
import type { OrderRow } from "@/lib/types";
import { advanceBatchAction, assignOrdersAction, saveBatchAction, supplierPaymentAction } from "../../ops-actions";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBatch(Number(id));
  if (!b) notFound();
  const dealers = await listDealers();
  const orders = (await db().prepare("SELECT * FROM orders WHERE batch_id = ? ORDER BY id").all(b.id)) as OrderRow[];
  const loose = (await db().prepare(
    "SELECT * FROM orders WHERE has_preorder = 1 AND batch_id IS NULL AND stage NOT IN ('Cancelled','Awaiting payment','Delivered','Collected') ORDER BY id",
  ).all()) as OrderRow[];
  const back = `/admin/batches/${b.id}`;
  const expenses = ((await db().prepare("SELECT COALESCE(SUM(amount),0) AS n FROM expenses WHERE batch_id = ?").get(b.id)) as { n: number }).n;
  const received = orders.filter((o) => o.stage !== "Cancelled").reduce((s, o) => s + o.paid_amount, 0);

  return (
    <div>
      <Link href="/admin/batches" className="eyebrow text-stone hover:text-ink">← All batches</Link>
      <h1 className="display mt-3 text-5xl">{b.name}</h1>
      <p className="mt-2 text-sm text-stone">Supplier: {b.dealer_name ?? "none"} · Stage: <strong className="text-ink">{b.stage}</strong>{b.eta && ` · ETA ${b.eta}`}</p>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Orders" value={b.orders} sub={`${b.units} pre-order units`} />
        <Stat label="Customers paid so far" value={formatLkr(received)} />
        <Stat label="Supplier cost" value={formatLkr(b.payable)} sub={`Paid ${formatLkr(b.paid)}`} />
        <Stat label="Batch expenses" value={formatLkr(expenses)} />
      </ul>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="eyebrow">Move the whole batch</h2>
          <form action={advanceBatchAction} className="mt-3 grid gap-3">
            <input type="hidden" name="id" value={b.id} />
            <select name="stage" defaultValue={b.stage} className="field" aria-label="Batch stage">{BATCH_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
            <input name="note" placeholder="Note shown to customers (optional)" className="field" />
            <button className="btn btn-primary w-fit">Update all orders in this batch</button>
            <p className="text-xs text-stone">Orders that have not paid their required amount are skipped and listed.</p>
          </form>

          <h2 className="eyebrow mt-10">Pay the supplier</h2>
          <form action={supplierPaymentAction} className="mt-3 flex flex-wrap gap-3">
            <input type="hidden" name="id" value={b.id} />
            <input name="amount" type="number" min={1} required placeholder="Amount (LKR)" className="field max-w-[12rem]" aria-label="Amount" />
            <button className="btn btn-ghost">Record payment</button>
          </form>

          <h2 className="eyebrow mt-10">Edit batch</h2>
          <form action={saveBatchAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={b.id} />
            <AField label="Name"><input name="name" defaultValue={b.name} required className="field" /></AField>
            <AField label="Supplier"><select name="dealer_id" defaultValue={b.dealer_id ?? 0} className="field"><option value="0">None</option>{dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></AField>
            <AField label="Expected arrival"><input name="eta" defaultValue={b.eta} className="field" /></AField>
            <AField label="Payable (LKR)"><input name="payable" type="number" min={0} defaultValue={b.payable} className="field" /></AField>
            <AField label="Notes" className="sm:col-span-2"><input name="notes" defaultValue={b.notes} className="field" /></AField>
            <button className="btn btn-ghost w-fit">Save</button>
          </form>
        </section>

        <section>
          <h2 className="eyebrow">Orders in this batch</h2>
          <form action={assignOrdersAction} className="mt-3">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="batch_id" value="0" />
            <ul className="divide-y divide-line border-y border-line text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <input type="checkbox" name="ref" value={o.reference} aria-label={`Select ${o.reference}`} />
                  <Link href={`/admin/orders/${o.reference}`} className="font-semibold underline">{o.reference}</Link>
                  <span className="text-stone">{o.customer_name}</span>
                  <span className="ml-auto text-xs">{o.stage}</span>
                </li>
              ))}
              {orders.length === 0 && <li className="py-6 text-center text-stone">No orders in this batch yet.</li>}
            </ul>
            {orders.length > 0 && <button className="btn btn-ghost mt-3">Take ticked orders out of the batch</button>}
          </form>

          <h2 className="eyebrow mt-10">Add pre-orders to this batch</h2>
          <form action={assignOrdersAction} className="mt-3">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="batch_id" value={b.id} />
            <ul className="divide-y divide-line border-y border-line text-sm">
              {loose.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <input type="checkbox" name="ref" value={o.reference} aria-label={`Select ${o.reference}`} />
                  <span className="font-semibold">{o.reference}</span>
                  <span className="text-stone">{o.customer_name}</span>
                  <span className="ml-auto text-xs">{o.stage}</span>
                </li>
              ))}
              {loose.length === 0 && <li className="py-6 text-center text-stone">Every active pre-order is already in a batch.</li>}
            </ul>
            {loose.length > 0 && <button className="btn btn-primary mt-3">Add ticked orders</button>}
          </form>
        </section>
      </div>
    </div>
  );
}
