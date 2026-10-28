import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { PostageCalculator } from "@/components/PostageCalculator";
import { formatLkr } from "@/lib/format";
import { getSettings, intSetting } from "@/lib/settings";
import { listZones } from "@/lib/shipping";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shipping and delivery" };

export default async function Shipping() {
  const s = await getSettings();
  const zones = await listZones();
  return (
    <PageShell eyebrow="Help" title="Shipping and delivery">
      <div className="max-w-2xl space-y-4 text-stone">
        <p>We deliver across the world.</p>
        <p><strong className="text-ink">Sri Lanka:</strong> delivery is {formatLkr(intSetting(s, "local_delivery_fee", 500))}. Prefer to collect? Store pickup is free.</p>
        <p><strong className="text-ink">Worldwide:</strong> we post by EMS through Sri Lanka Post. Postage is calculated from your country and the weight of your parcel, and is added at checkout. International orders are paid in full.</p>
        <p><strong className="text-ink">Pre-orders</strong> arrive in {s.preorder_weeks}. You can track every step from the tracking page.</p>
      </div>
      <div className="mt-12"><PostageCalculator /></div>
      <h2 className="eyebrow mt-16">Postage zones</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-y border-line text-left text-sm">
          <thead className="eyebrow text-stone"><tr><th className="py-3 pr-4">Zone</th><th className="pr-4">First kg</th><th className="pr-4">Each extra kg</th><th>Time</th></tr></thead>
          <tbody className="divide-y divide-line">
            {zones.map((z) => (
              <tr key={z.id}><td className="py-3 pr-4 font-semibold">{z.name}</td><td className="pr-4">{formatLkr(z.firstKg)}</td><td className="pr-4">{formatLkr(z.extraKg)}</td><td>{z.days}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
