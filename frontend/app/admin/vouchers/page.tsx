import { Flash } from "@/components/AdminBits";
import { Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { listGiftCards } from "@/lib/gift";
import { listVouchers } from "@/lib/vouchers";
import { formatLkr } from "@/lib/format";
import { createVoucherAction, deleteVoucherAction, toggleVoucherAction } from "../promo-actions";

export const dynamic = "force-dynamic";
const fmt = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-LK", { dateStyle: "medium", timeZone: "Asia/Colombo" }) : "");

export default async function VouchersPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [vouchers, gifts] = await Promise.all([listVouchers(), listGiftCards()]);
  return (
    <div>
      <h1 className="display text-5xl">Vouchers and gift cards</h1>
      <Hint>Voucher codes give a discount on the products in an order (never on postage). Customers enter them at checkout. Gift cards are bought on the Gift cards page and appear below once paid. The gift card offers and validity are set in Settings.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>

      <h2 className="eyebrow mt-8">New voucher</h2>
      <form action={createVoucherAction} className="mt-4 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label><span className="eyebrow mb-2 block text-stone">Code</span><input name="code" required placeholder="WELCOME10" className="field uppercase" autoCapitalize="characters" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Type</span>
          <select name="kind" className="field"><option value="percent">Percent off</option><option value="fixed">Fixed amount off (LKR)</option></select></label>
        <label><span className="eyebrow mb-2 block text-stone">Value (% or LKR)</span><input name="value" type="number" min={1} required className="field" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Minimum order (LKR, 0 = none)</span><input name="min_spend" type="number" min={0} defaultValue={0} className="field" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Max discount for % (LKR, 0 = none)</span><input name="max_discount" type="number" min={0} defaultValue={0} className="field" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Starts (optional)</span><input name="from" type="date" className="field" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Ends (optional)</span><input name="to" type="date" className="field" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Total uses (0 = unlimited)</span><input name="max_uses" type="number" min={0} defaultValue={0} className="field" /></label>
        <label><span className="eyebrow mb-2 block text-stone">Uses per customer email (0 = unlimited)</span><input name="per_email" type="number" min={0} defaultValue={1} className="field" /></label>
        <label className="sm:col-span-2"><span className="eyebrow mb-2 block text-stone">Note (only you see this)</span><input name="note" maxLength={200} className="field" /></label>
        <div className="flex items-end"><button className="btn btn-primary w-full">Create voucher</button></div>
      </form>

      <h2 className="eyebrow mt-12">Vouchers</h2>
      {vouchers.length === 0 ? <p className="mt-3 text-sm text-stone">No vouchers yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-stone"><th className="py-2 pr-4">Code</th><th className="pr-4">Discount</th><th className="pr-4">Rules</th><th className="pr-4">Used</th><th className="pr-4">Status</th><th /></tr></thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.code} className="border-b border-line align-top">
                  <td className="py-3 pr-4 font-mono font-semibold">{v.code}{v.note && <span className="block font-sans text-xs font-normal text-stone">{v.note}</span>}</td>
                  <td className="pr-4">{v.kind === "percent" ? `${v.value}%${v.maxDiscount ? `, max ${formatLkr(v.maxDiscount)}` : ""}` : formatLkr(v.value)}</td>
                  <td className="pr-4 text-xs text-stone">
                    {v.minSpend > 0 ? `Min ${formatLkr(v.minSpend)}. ` : ""}{v.perEmail > 0 ? `${v.perEmail} per email. ` : ""}
                    {v.startsAt ? `From ${fmt(v.startsAt)}. ` : ""}{v.expiresAt ? `Until ${fmt(v.expiresAt)}.` : ""}
                  </td>
                  <td className="pr-4">{v.usedCount}{v.maxUses ? ` / ${v.maxUses}` : ""}</td>
                  <td className="pr-4">{v.active ? "On" : "Off"}</td>
                  <td className="space-x-3 whitespace-nowrap">
                    <form action={toggleVoucherAction} className="inline"><input type="hidden" name="code" value={v.code} /><input type="hidden" name="active" value={v.active ? "0" : "1"} /><button className="text-xs underline">{v.active ? "Switch off" : "Switch on"}</button></form>
                    {v.usedCount === 0 && <form action={deleteVoucherAction} className="inline"><input type="hidden" name="code" value={v.code} /><button className="text-xs underline text-stone">Delete</button></form>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="eyebrow mt-12">Gift cards issued</h2>
      {gifts.length === 0 ? <p className="mt-3 text-sm text-stone">None yet. A card is issued automatically when its order is paid.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-stone"><th className="py-2 pr-4">Code</th><th className="pr-4">Balance</th><th className="pr-4">Issued</th><th className="pr-4">Expires</th><th>Order</th></tr></thead>
            <tbody>
              {gifts.map((g) => (
                <tr key={g.code} className="border-b border-line">
                  <td className="py-2 pr-4 font-mono">{g.code}</td>
                  <td className="pr-4">{formatLkr(g.balance)} <span className="text-xs text-stone">of {formatLkr(g.issued)}</span></td>
                  <td className="pr-4 text-xs text-stone">{fmt(g.created_at)}</td>
                  <td className="pr-4 text-xs text-stone">{fmt(g.expires_at)}</td>
                  <td className="text-xs text-stone">{g.note.replace("Gift card, order ", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
