import { ExportLink } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { countryName } from "@/lib/countries";
import { formatLkr } from "@/lib/format";
import { listCustomers } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function Customers() {
  await requireAdmin();
  const list = await listCustomers();
  return (
    <div>
      <div className="flex items-end justify-between gap-4"><h1 className="display text-5xl">Customers</h1><ExportLink kind="customers" /></div>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-3 pr-4">Customer</th><th className="pr-4">Phone</th><th className="pr-4">Country</th><th className="pr-4">Orders</th><th className="pr-4">Paid</th><th>Last order</th></tr></thead>
          <tbody className="divide-y divide-line">
            {list.map((c) => (
              <tr key={c.email}>
                <td className="py-3 pr-4">{c.name}<div className="text-xs text-stone">{c.email}</div></td>
                <td className="pr-4"><a className="underline" href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^0/, "94")}`} target="_blank" rel="noreferrer">{c.phone}</a></td>
                <td className="pr-4">{countryName(c.country)}</td><td className="pr-4">{c.orders}</td><td className="pr-4">{formatLkr(c.spent)}</td><td className="text-stone">{c.last}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-stone">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
