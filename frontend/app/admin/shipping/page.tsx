import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { countryName } from "@/lib/countries";
import { PACKAGING_G, listZones, type Zone } from "@/lib/shipping";
import { deleteZoneAction, saveZoneAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function ShippingAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <div>
      <h1 className="display text-5xl">Shipping rates</h1>
      <Hint>
        International postage = first kg price + extra kg price for each further started kg. Parcel weight is the product weights plus {PACKAGING_G} g packaging.
        <strong className="text-ink"> The starting rates are placeholder estimates. Replace them with your real Sri Lanka Post or courier prices before you launch.</strong>{" "}
        A zone with <code>*</code> as its country list is used for any country not listed in another zone. Sri Lanka delivery and pickup are set in Settings.
      </Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <div className="space-y-4">
        {(await listZones()).map((z) => (
          <details key={z.id} className="border border-line">
            <summary className="flex cursor-pointer items-center justify-between p-4"><strong>{z.name}</strong><span className="text-xs text-stone">{z.countries.includes("*") ? "All other countries" : `${z.countries.length} countries`} · Edit</span></summary>
            <div className="border-t border-line p-4">
              <ZoneForm z={z} />
              <form action={deleteZoneAction} className="mt-3"><input type="hidden" name="id" value={z.id} /><button className="text-xs underline text-stone">Delete zone</button></form>
            </div>
          </details>
        ))}
      </div>
      <h2 className="eyebrow mt-10">Add a zone</h2>
      <div className="mt-4 border border-line p-4"><ZoneForm /></div>
    </div>
  );
}

function ZoneForm({ z }: { z?: Zone }) {
  return (
    <form action={saveZoneAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={z?.id ?? 0} />
      <AField label="Zone name"><input name="name" required defaultValue={z?.name} className="field" /></AField>
      <AField label="Delivery time"><input name="days" defaultValue={z?.days} placeholder="7 to 14 working days" className="field" /></AField>
      <AField label="First kg (LKR)"><input name="first" type="number" min={0} defaultValue={z?.firstKg ?? 0} className="field" /></AField>
      <AField label="Each extra kg (LKR)"><input name="extra" type="number" min={0} defaultValue={z?.extraKg ?? 0} className="field" /></AField>
      <AField label="Countries (names or 2-letter codes, separated by commas)" className="sm:col-span-2">
        <textarea name="countries" rows={3} defaultValue={z?.countries.map((c) => (c === "*" ? "*" : `${countryName(c)}`)).join(", ")} className="field" />
      </AField>
      <button className="btn btn-primary w-fit">Save zone</button>
    </form>
  );
}
