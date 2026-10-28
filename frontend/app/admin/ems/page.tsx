import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { COUNTRIES, countryName } from "@/lib/countries";
import { formatLkr } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { listEms } from "@/lib/shipping";
import { deleteEmsAction, emsSettingsAction, importEmsAction, saveEmsAction, toggleEmsAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function EmsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const rows = await listEms();
  return (
    <div>
      <h1 className="display text-5xl">EMS rates (Sri Lanka Post)</h1>
      <Hint>
        International parcels are priced from the EMS rates you enter here, per country. Countries without an EMS row use the zone table in Shipping rates.
        Sri Lanka Post&apos;s own calculator is a website we cannot call from the store, so you copy the prices across once, and update them when Sri Lanka Post changes its tariff.
      </Hint>
      <ol className="mt-4 max-w-2xl list-decimal space-y-1 pl-5 text-sm text-stone">
        <li>Open the official <a className="underline" href="https://bepost.lk/m/calf/" target="_blank" rel="noreferrer">Sri Lanka Post foreign postage calculator</a> (or the <a className="underline" href="https://slpost.gov.lk/tariff" target="_blank" rel="noreferrer">tariff page</a>) and choose the country.</li>
        <li>Enter 250, 500, 1000 and 1500 grams and note the EMS price for each.</li>
        <li>Fill the form below: the first three are the prices. &quot;Each extra 500 g&quot; is the price at 1500 g minus the price at 1000 g.</li>
      </ol>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <form action={toggleEmsAction} className="mb-8 flex max-w-3xl flex-wrap items-center gap-4 border border-line p-5">
        <div className="flex-1 min-w-[16rem]">
          <p className="eyebrow">EMS service</p>
          <p className="mt-1 text-sm"><strong>{s.ems_enabled === "no" ? "OFF" : "ON"}</strong>. {s.ems_enabled === "no" ? "Customers abroad are priced from the Shipping rates zone table. Your saved EMS rates are kept." : "Customers abroad are priced from the EMS rates below, where a country has a rate."}</p>
        </div>
        <input type="hidden" name="ems_enabled" value={s.ems_enabled === "no" ? "yes" : "no"} />
        <button className={s.ems_enabled === "no" ? "btn btn-primary" : "btn btn-ghost"}>{s.ems_enabled === "no" ? "Switch EMS ON" : "Switch EMS OFF"}</button>
      </form>
      {rows.length === 0 && <p className="mb-6 border-l-2 border-accent bg-mist p-4 text-sm">No EMS rates entered yet, so customers abroad are currently charged from the placeholder zone estimates.</p>}

      <form action={emsSettingsAction} className="mb-10 grid max-w-3xl gap-4 sm:grid-cols-3 sm:items-end">
        <AField label="Extra % on top (packing, handling)"><input name="ems_markup_pct" type="number" min={0} max={200} step="0.5" defaultValue={s.ems_markup_pct} className="field" /></AField>
        <AField label="Rates last checked (date)"><input name="ems_checked" type="date" defaultValue={s.ems_checked} className="field" /></AField>
        <button className="btn btn-ghost w-fit">Save</button>
      </form>

      <h2 className="eyebrow">Add or update a country</h2>
      <form action={saveEmsAction} className="mt-4 grid max-w-4xl gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <AField label="Country" className="sm:col-span-3 lg:col-span-2"><select name="country" className="field">{COUNTRIES.filter((c) => c.code !== "LK").map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></AField>
        <AField label="Up to 250 g"><input name="p250" type="number" min={1} required className="field" /></AField>
        <AField label="Up to 500 g"><input name="p500" type="number" min={1} required className="field" /></AField>
        <AField label="Up to 1 kg"><input name="p1000" type="number" min={1} required className="field" /></AField>
        <AField label="Each extra 500 g"><input name="step500" type="number" min={0} required className="field" /></AField>
        <AField label="Max parcel kg"><input name="max_kg" type="number" min={1} max={70} defaultValue={20} className="field" /></AField>
        <button className="btn btn-primary w-fit sm:col-span-3 lg:col-span-6">Save country</button>
      </form>

      <h2 className="eyebrow mt-12">Paste many at once</h2>
      <form action={importEmsAction} className="mt-4 max-w-3xl">
        <textarea name="paste" rows={6} className="field font-mono text-xs" placeholder={"country, 250 g, 500 g, 1 kg, each extra 500 g, max kg\nIndia, 4000, 4300, 4900, 800, 20\nUnited Kingdom, 5600, 6000, 6900, 1100, 20"} aria-label="Rates to paste" />
        <p className="mt-2 text-xs text-stone">Names or 2-letter codes. If any line is wrong nothing is saved.</p>
        <button className="btn btn-ghost mt-3">Save pasted rates</button>
      </form>

      <h2 className="eyebrow mt-12">Saved EMS rates ({rows.length})</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone"><tr><th className="py-3 pr-4">Country</th><th className="pr-4">250 g</th><th className="pr-4">500 g</th><th className="pr-4">1 kg</th><th className="pr-4">Each +500 g</th><th className="pr-4">Max kg</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.country}>
                <td className="py-3 pr-4 font-semibold">{countryName(r.country)}</td>
                <td className="pr-4">{formatLkr(r.p250)}</td><td className="pr-4">{formatLkr(r.p500)}</td><td className="pr-4">{formatLkr(r.p1000)}</td><td className="pr-4">{formatLkr(r.step500)}</td><td className="pr-4">{r.max_kg}</td>
                <td><form action={deleteEmsAction}><input type="hidden" name="country" value={r.country} /><button className="text-xs underline text-stone">Remove</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
