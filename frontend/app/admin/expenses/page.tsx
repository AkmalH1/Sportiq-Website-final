import { Flash } from "@/components/AdminBits";
import { AField, ExportLink, Stat } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { formatLkr } from "@/lib/format";
import { EXPENSE_CATEGORIES, dashboard, listBatches, listExpenses } from "@/lib/ops";
import { addExpenseAction, deleteExpenseAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function Expenses({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const list = await listExpenses();
  const d = await dashboard();
  const total = list.reduce((s, e) => s + e.amount, 0);
  const profit = d.received - d.supplierPaid - d.expenses;
  const batches = await listBatches();
  return (
    <div>
      <h1 className="display text-5xl">Expenses and profit</h1>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Money received" value={formatLkr(d.received)} />
        <Stat label="Paid to suppliers" value={formatLkr(d.supplierPaid)} />
        <Stat label="Other expenses" value={formatLkr(total)} />
        <Stat label="Estimated profit" value={formatLkr(profit)} sub="Received minus supplier payments and expenses" />
      </ul>

      <h2 className="eyebrow mt-12">Add an expense</h2>
      <form action={addExpenseAction} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
        <AField label="Category"><select name="category" className="field">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></AField>
        <AField label="Amount (LKR)"><input name="amount" type="number" min={1} required className="field" /></AField>
        <AField label="Date"><input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="field" /></AField>
        <AField label="Batch (optional)"><select name="batch_id" className="field"><option value="0">None</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></AField>
        <AField label="Description" className="sm:col-span-2"><input name="description" className="field" /></AField>
        <button className="btn btn-primary w-fit">Add expense</button>
      </form>

      <div className="mt-12 flex items-center justify-between"><h2 className="eyebrow">History</h2><ExportLink kind="expenses" /></div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-3 pr-4">Date</th><th className="pr-4">Category</th><th className="pr-4">Amount</th><th className="pr-4">Note</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {list.map((e) => (
              <tr key={e.id}>
                <td className="py-3 pr-4">{e.spent_on}</td><td className="pr-4">{e.category}</td><td className="pr-4">{formatLkr(e.amount)}</td><td className="pr-4 text-stone">{e.description}</td>
                <td><form action={deleteExpenseAction}><input type="hidden" name="id" value={e.id} /><button className="text-xs underline text-stone">Delete</button></form></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-stone">No expenses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
