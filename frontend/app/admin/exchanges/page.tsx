import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { formatLkr } from "@/lib/format";
import { listCredits, listExchanges } from "@/lib/exchanges";
import { getSettings } from "@/lib/settings";
import { exchangeAction, issueCreditAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function Exchanges({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div>
      <h1 className="display text-5xl">Exchanges and store credit</h1>
      <Hint>We exchange or give store credit, never cash refunds. Check each request with the customer on WhatsApp ({s.phone_display}), then approve it here. If an exchange is not possible, issue store credit below and send the customer the code.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>

      <h2 className="eyebrow">Requests</h2>
      <ul className="mt-4 space-y-4">
        {(await listExchanges()).map((x) => (
          <li key={x.id} className="border border-line p-5">
            <p><strong>{x.name}</strong> · {x.order_reference || "no reference"} · <span className="eyebrow">{x.status}</span></p>
            <p className="mt-1 text-sm text-stone">{x.item}</p>
            <p className="mt-2 text-sm">{x.reason}</p>
            <p className="mt-2 text-xs text-stone">
              Contact: <a className="underline" href={/@/.test(x.contact) ? `mailto:${x.contact}` : `https://wa.me/${x.contact.replace(/\D/g, "").replace(/^0/, "94")}`} target="_blank" rel="noreferrer">{x.contact}</a> · {x.created_at}
            </p>
            {x.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={x.image_url} target="_blank" rel="noreferrer"><img src={x.image_url} alt="Item photo" className="mt-3 h-28 w-28 object-cover" /></a>
            )}
            <form action={exchangeAction} className="mt-4 flex flex-wrap gap-3">
              <input type="hidden" name="id" value={x.id} />
              <select name="status" defaultValue={x.status} className="field w-40" aria-label="Status">{["new", "approved", "rejected", "completed"].map((o) => <option key={o}>{o}</option>)}</select>
              <input name="note" defaultValue={x.admin_note} placeholder="Internal note" className="field max-w-xs" aria-label="Note" />
              <button className="btn btn-ghost">Update</button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="eyebrow mt-14">Issue store credit</h2>
      <form action={issueCreditAction} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-3">
        <AField label="Customer email (optional, locks the code to them)"><input name="email" type="email" className="field" /></AField>
        <AField label="Amount (LKR)"><input name="amount" type="number" min={1} required className="field" /></AField>
        <AField label="Reason"><input name="note" placeholder="e.g. exchange SIQ-XXXX" className="field" /></AField>
        <button className="btn btn-primary w-fit">Issue credit</button>
      </form>

      <h2 className="eyebrow mt-10">Credit codes</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-3 pr-4">Code</th><th className="pr-4">Customer</th><th className="pr-4">Balance</th><th className="pr-4">Issued</th><th>Reason</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(await listCredits()).map((c) => (
              <tr key={c.code}><td className="py-3 pr-4 font-mono">{c.code}</td><td className="pr-4">{c.email || "anyone"}</td><td className="pr-4">{formatLkr(c.balance)}</td><td className="pr-4">{formatLkr(c.issued)}</td><td className="text-stone">{c.note}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
