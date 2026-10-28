import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { formatLkr } from "@/lib/format";
import { listDealers, type Dealer } from "@/lib/ops";
import { deleteDealerAction, saveDealerAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function Suppliers({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <div>
      <h1 className="display text-5xl">Suppliers</h1>
      <Hint>Who you buy from. What you owe and have paid comes from each batch you create for them.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <div className="space-y-4">
        {(await listDealers()).map((d) => (
          <details key={d.id} className="border border-line">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
              <span><strong>{d.name}</strong> <span className="text-xs text-stone">{d.country}</span></span>
              <span className="text-sm">Owed {formatLkr(Math.max(0, d.payable - d.paid))} · <span className="text-stone">{d.status}</span></span>
            </summary>
            <div className="border-t border-line p-4">
              <DealerForm d={d} />
              <form action={deleteDealerAction} className="mt-3"><input type="hidden" name="id" value={d.id} /><button className="text-xs underline text-stone">Delete supplier</button></form>
            </div>
          </details>
        ))}
      </div>
      <h2 className="eyebrow mt-10">Add a supplier</h2>
      <div className="mt-4 border border-line p-4"><DealerForm /></div>
    </div>
  );
}

function DealerForm({ d }: { d?: Dealer }) {
  return (
    <form action={saveDealerAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={d?.id ?? 0} />
      <AField label="Name"><input name="name" required defaultValue={d?.name} className="field" /></AField>
      <AField label="Country"><input name="country" defaultValue={d?.country} className="field" /></AField>
      <AField label="WhatsApp"><input name="whatsapp" defaultValue={d?.whatsapp} className="field" /></AField>
      <AField label="Notes"><input name="notes" defaultValue={d?.notes} className="field" /></AField>
      <button className="btn btn-primary w-fit">Save</button>
    </form>
  );
}
