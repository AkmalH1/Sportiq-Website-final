import { Flash } from "@/components/AdminBits";
import { Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { getTexts } from "@/lib/site-text";
import { TEXT_DEFS } from "@/lib/site-text-defs";
import { saveSiteTextAction } from "../site-text-actions";

export const dynamic = "force-dynamic";

export default async function SiteText({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const texts = await getTexts();
  const groups = [...new Set(TEXT_DEFS.map((d) => d.group))];
  return (
    <div>
      <h1 className="display text-5xl">Site text</h1>
      <Hint>Change the wording on the home page, the footer and the gift cards page, and switch home page sections on or off. Clear a box and save to go back to the original wording. The banner photo and headline are in Banners, products and categories are in their own pages, prices and gift card offers are in Settings.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <form action={saveSiteTextAction} className="space-y-4">
        {groups.map((g) => (
          <details key={g} className="border border-line" open={g === groups[0]}>
            <summary className="cursor-pointer p-4"><strong>{g}</strong></summary>
            <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
              {TEXT_DEFS.filter((d) => d.group === g).map((d) => (
                <div key={d.key} className={d.kind === "long" || d.kind === "lines" ? "sm:col-span-2" : ""}>
                  {d.kind === "toggle" ? (
                    <label className="flex items-center gap-3 text-sm">
                      <input type="hidden" name={d.key} value="0" />
                      <input type="checkbox" name={d.key} value="1" defaultChecked={texts[d.key] !== "0"} /> {d.label}
                    </label>
                  ) : (
                    <label className="block">
                      <span className="eyebrow mb-2 block text-stone">{d.label}</span>
                      {d.kind === "long" || d.kind === "lines"
                        ? <textarea name={d.key} rows={d.kind === "lines" ? 6 : 3} defaultValue={texts[d.key]} placeholder={d.def} className="field" />
                        : <input name={d.key} defaultValue={texts[d.key]} placeholder={d.def} className="field" />}
                    </label>
                  )}
                  {d.help && <p className="mt-1 text-xs text-stone">{d.help}</p>}
                </div>
              ))}
            </div>
          </details>
        ))}
        <button className="btn btn-primary">Save all</button>
      </form>
    </div>
  );
}
