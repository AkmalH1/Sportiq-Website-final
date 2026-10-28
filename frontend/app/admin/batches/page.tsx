import Link from "next/link";
import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { formatLkr } from "@/lib/format";
import { listBatches, listDealers } from "@/lib/ops";
import { saveBatchAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function Batches({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const batches = await listBatches();
  const dealers = await listDealers();
  return (
    <div>
      <h1 className="display text-5xl">Pre-order batches</h1>
      <Hint>A batch is one order placed with a supplier. Put customers&apos; pre-orders into a batch, then move the whole batch through Supplier Paid, Production, Shipping and Arrived. Every customer&apos;s tracking page updates at once.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-3 pr-4">Batch</th><th className="pr-4">Supplier</th><th className="pr-4">Stage</th><th className="pr-4">Orders</th><th className="pr-4">Units</th><th className="pr-4">Supplier cost</th><th>Paid</th></tr></thead>
          <tbody className="divide-y divide-line">
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="py-3 pr-4"><Link href={`/admin/batches/${b.id}`} className="font-semibold underline">{b.name}</Link><div className="text-xs text-stone">{b.eta && `ETA ${b.eta}`}</div></td>
                <td className="pr-4">{b.dealer_name ?? "-"}</td>
                <td className="pr-4">{b.stage}</td>
                <td className="pr-4">{b.orders}</td>
                <td className="pr-4">{b.units}</td>
                <td className="pr-4">{formatLkr(b.payable)}</td>
                <td>{formatLkr(b.paid)}</td>
              </tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-stone">No batches yet. Create the first one below.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="eyebrow mt-12">New batch</h2>
      <form action={saveBatchAction} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
        <AField label="Batch name"><input name="name" required placeholder="e.g. NBA drop, Nov week 1" className="field" /></AField>
        <AField label="Supplier">
          <select name="dealer_id" className="field"><option value="0">None yet</option>{dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </AField>
        <AField label="Expected arrival"><input name="eta" placeholder="e.g. 20 Nov" className="field" /></AField>
        <AField label="Amount payable to supplier (LKR)"><input name="payable" type="number" min={0} defaultValue={0} className="field" /></AField>
        <AField label="Notes" className="sm:col-span-2"><input name="notes" className="field" /></AField>
        <button className="btn btn-primary w-fit">Create batch</button>
      </form>
    </div>
  );
}
