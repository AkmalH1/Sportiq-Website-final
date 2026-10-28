import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/AdminBits";
import { requireAdmin } from "@/lib/admin-auth";
import { formatLkr } from "@/lib/format";
import { getOrderAsAdmin } from "@/lib/orders";
import { SITE_URL } from "@/lib/config";
import { stageMessage } from "@/lib/ops";
import { countryName } from "@/lib/countries";
import { describeOptions, parseOptions } from "@/lib/options";
import { cancelOrderAction, confirmBankAction, recordCashAction, rejectBankAction, stageAction } from "../../actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ ok?: string; err?: string }> };

export default async function AdminOrder({ params, searchParams }: Props) {
  await requireAdmin();
  const { reference } = await params;
  const sp = await searchParams;
  const parts = await getOrderAsAdmin(reference);
  if (!parts) notFound();
  const { order, items, events, payments, stages } = parts;
  const cancelled = order.stage === "Cancelled";

  return (
    <div>
      <Link href="/admin" className="eyebrow text-stone hover:text-ink">← All orders</Link>
      <h1 className="display mt-3 text-5xl">{order.reference}</h1>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="eyebrow">Customer</h2>
          <p className="mt-3 text-sm">{order.customer_name}<br />{order.email} · {order.phone}<br />{order.address}, {order.city}{order.postal_code ? ` ${order.postal_code}` : ""}<br />{countryName(order.country)} · {order.delivery_method}</p>
          <p className="mt-2 text-sm"><a className="underline" href={`https://wa.me/${order.phone.replace(/\D/g, "").replace(/^0/, "94")}?text=${encodeURIComponent(stageMessage(order, SITE_URL))}`} target="_blank" rel="noreferrer">WhatsApp customer with the {order.stage} update</a></p>
          <h2 className="eyebrow mt-8">Items</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-2.5">
                <span>{i.name} · {i.size} × {i.qty} <span className="eyebrow ml-1">{i.source}</span> <span className="text-xs text-stone">{i.sku}</span>
                  <OptionDetail json={i.options} />
                </span>
                <span>{formatLkr((i.unit_price + i.addon_price) * i.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">Total {formatLkr(order.total)} · Paid {formatLkr(order.paid_amount)} · Plan {order.payment_plan} (due now {formatLkr(order.due_now)})</p>
        </section>

        <section>
          <h2 className="eyebrow">Payments</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {payments.length === 0 && <li className="py-3 text-stone">No payment attempts yet.</li>}
            {payments.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex justify-between gap-4"><span>{p.provider} · {formatLkr(p.amount)} · <strong>{p.status}</strong></span><span className="text-xs text-stone">{p.provider_order_id}</span></div>
                <p className="text-xs text-stone">Purpose: {p.purpose}{p.verified_by ? ` · ${p.status === "rejected" ? "rejected" : "verified"} by ${p.verified_by} (${p.verification_source || "—"}) ${p.verified_at ?? ""}` : ""}</p>
                {p.provider_ref && <p className="text-xs text-stone">Reference: {p.provider_ref}</p>}
                {p.proof_file && <p className="mt-1 text-xs"><a href={`/admin/proof/${p.proof_file}`} target="_blank" rel="noopener noreferrer" className="underline">View receipt photo (private)</a></p>}
                {p.note && <p className="text-xs text-stone">{p.note}</p>}
                {p.provider === "bank" && p.status === "submitted" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <form action={confirmBankAction}>
                      <input type="hidden" name="reference" value={order.reference} /><input type="hidden" name="payment_id" value={p.id} />
                      <button className="btn btn-primary">I checked the bank record: confirm</button>
                    </form>
                    <form action={rejectBankAction} className="flex gap-2">
                      <input type="hidden" name="reference" value={order.reference} /><input type="hidden" name="payment_id" value={p.id} />
                      <input name="note" placeholder="Reason" className="field w-48" aria-label="Rejection reason" />
                      <button className="btn btn-ghost">Reject</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {!cancelled && order.total - order.paid_amount > 0 && (
            <>
              <h2 className="eyebrow mt-8">Record cash collected</h2>
              <form action={recordCashAction} className="mt-3 flex flex-wrap gap-3">
                <input type="hidden" name="reference" value={order.reference} />
                <input name="amount" type="number" min={1} max={order.total - order.paid_amount} defaultValue={order.total - order.paid_amount} className="field w-40" aria-label="Cash amount in LKR" />
                <button className="btn btn-ghost">Record cash</button>
                <p className="w-full text-xs text-stone">Use this when the customer pays the balance in cash on delivery or at the store.</p>
              </form>
            </>
          )}

          {!cancelled && (
            <>
              <h2 className="eyebrow mt-8">Move to stage</h2>
              <form action={stageAction} className="mt-3 grid gap-3">
                <input type="hidden" name="reference" value={order.reference} />
                <select name="stage" defaultValue={order.stage} className="field" aria-label="Stage">
                  {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input name="note" placeholder="Note shown to the customer (tracking number, ETA…)" className="field" />
                <button className="btn btn-primary w-fit">Update stage</button>
                <p className="text-xs text-stone">Stages need the required payment first. Delivered or Collected needs the full balance paid or recorded.</p>
              </form>
              {order.paid_amount === 0 && (
                <form action={cancelOrderAction} className="mt-6">
                  <input type="hidden" name="reference" value={order.reference} />
                  <button className="btn btn-ghost">Cancel unpaid order and release stock</button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      <h2 className="eyebrow mt-12">History</h2>
      <ol className="mt-3 divide-y divide-line border-y border-line text-sm">
        {[...events].reverse().map((e, i) => (
          <li key={i} className="flex flex-wrap justify-between gap-4 py-2.5"><span><strong>{e.stage}</strong> {e.note && <span className="text-stone">· {e.note}</span>} <span className="text-xs text-stone">({e.actor})</span></span><time className="text-stone">{e.created_at}</time></li>
        ))}
      </ol>
    </div>
  );
}

function OptionDetail({ json }: { json: string }) {
  const o = parseOptions(json);
  const lines = describeOptions(o);
  if (lines.length === 0) return null;
  const imgs = [o.customImage, ...o.patches.map((p) => p.image)].filter(Boolean);
  return (
    <span className="mt-1 block text-xs text-stone">
      {lines.map((l) => <span key={l} className="block">{l}</span>)}
      {imgs.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 underline">image</a>)}
    </span>
  );
}
