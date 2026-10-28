import { Flash } from "@/components/AdminBits";
import { Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { listSportsAdmin } from "@/lib/categories";
import { listCompetitionsAdmin } from "@/lib/competitions";
import { listSubgroupsAdmin } from "@/lib/subgroups";
import { addSubgroupAction, deleteSubgroupAction, saveSubgroupAction } from "../subgroup-actions";
import { addCompetitionAction, deleteCompetitionAction, saveCompetitionAction } from "../competition-actions";
import { addSportAction, addSubAction, deleteSportAction, deleteSubAction, saveSportAction, saveSubAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function Categories({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const sports = await listSportsAdmin();
  const allComps = await listCompetitionsAdmin();
  const allGroups = await listSubgroupsAdmin();
  return (
    <div>
      <h1 className="display text-5xl">Categories</h1>
      <Hint>Categories are the sports in the menu and on the homepage. Rename them, change the order, hide them, or add new ones. Subcategories sit inside each category, and each subcategory can have subgroups with a list of brands (open Subgroups and brands under a subcategory). Each category or subcategory can have its own size chart, shown as a Size chart button on every product in it. Hidden categories disappear from the site but keep their products.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <div className="space-y-4">
        {sports.map((s) => (
          <details key={s.slug} className="border border-line">
            <summary className="flex cursor-pointer items-center justify-between p-4">
              <span><strong>{s.name}</strong> <span className="text-xs text-stone">/{s.slug}</span>{!s.active && <span className="ml-3 text-xs text-stone">hidden</span>}</span>
              <span className="text-xs text-stone">{s.subs.length} subcategories · Edit</span>
            </summary>
            <div className="space-y-8 border-t border-line p-4">
              <form action={saveSportAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_6rem_auto] sm:items-end">
                <input type="hidden" name="slug" value={s.slug} />
                <label><span className="eyebrow mb-2 block text-stone">Name</span><input name="name" defaultValue={s.name} required className="field" /></label>
                <label><span className="eyebrow mb-2 block text-stone">Tagline</span><input name="tagline" defaultValue={s.tagline} className="field" /></label>
                <label><span className="eyebrow mb-2 block text-stone">Colour</span><input name="accent" defaultValue={s.accent} className="field" /></label>
                <label><span className="eyebrow mb-2 block text-stone">Order</span><input name="sort" type="number" defaultValue={s.sort} className="field" /></label>
                <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> Show</label><button className="btn btn-primary">Save</button></div>
                <label className="sm:col-span-5"><span className="eyebrow mb-2 block text-stone">Size chart for the whole category (optional, used when a subcategory has none)</span><textarea name="size_chart" rows={4} defaultValue={s.sizeChart} placeholder={"Size,Chest (cm),Length (cm)\nS,96,68\nM,102,70"} className="field font-mono text-xs" /></label>
              </form>

              <div>
                <p className="eyebrow">Subcategories</p>
                <ul className="mt-3 space-y-2">
                  {s.subs.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3">
                      <form action={saveSubAction} className="flex w-full flex-wrap items-start gap-3 border-l-2 border-line pl-3">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="name" defaultValue={c.name} required className="field w-52" aria-label="Subcategory name" />
                        <input name="sort" type="number" defaultValue={c.sort} className="field w-20" aria-label="Order" />
                        <label className="flex h-12 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} /> Show</label>
                        <button className="btn btn-ghost !px-4 !py-2 text-xs">Save</button>
                        <details className="w-full"><summary className="cursor-pointer text-xs underline text-stone">Size chart{c.sizeChart ? " (set)" : ""}</summary>
                          <textarea name="size_chart" rows={5} defaultValue={c.sizeChart} placeholder={"Size,Chest (cm),Length (cm)\nS,96,68\nM,102,70\n# Note shown under the table"} className="field mt-2 font-mono text-xs" />
                        </details>
                      </form>
                      <form action={deleteSubAction}><input type="hidden" name="id" value={c.id} /><button className="text-xs underline text-stone">Delete</button></form>
                      <details className="ml-3 w-full border-l-2 border-accent/50 pl-3" open={allGroups.some((g) => g.sportSlug === s.slug && g.subSlug === c.slug)}>
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone">Subgroups and brands in {c.name} ({allGroups.filter((g) => g.sportSlug === s.slug && g.subSlug === c.slug).length})</summary>
                        <p className="mt-2 max-w-2xl text-xs text-stone">Example: subcategory <em>Jerseys</em>, subgroup <em>Club kits</em>, brands <em>Nike, Adidas, Puma</em>. The subgroup appears on the site under {c.name} once a published product is assigned to it (product page, or the <code>subgroup</code> and <code>brand</code> columns in the bulk import). Its brands then show under it.</p>
                        <ul className="mt-3 space-y-3">
                          {allGroups.filter((g) => g.sportSlug === s.slug && g.subSlug === c.slug).map((g) => (
                            <li key={g.id} className="flex flex-wrap items-start gap-3">
                              <form action={saveSubgroupAction} className="grid w-full gap-3 sm:grid-cols-[14rem_1fr_5rem_auto] sm:items-start">
                                <input type="hidden" name="id" value={g.id} />
                                <input name="name" defaultValue={g.name} required className="field" aria-label="Subgroup name" />
                                <textarea name="brands" rows={2} defaultValue={g.brandsText} placeholder={"Brands, one per line or separated by commas\nNike\nAdidas"} className="field text-sm" aria-label={`Brands in ${g.name}`} />
                                <input name="sort" type="number" defaultValue={g.sort} className="field" aria-label="Order" />
                                <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={g.active} /> Show</label><button className="btn btn-ghost !px-4 !py-2 text-xs">Save</button></div>
                              </form>
                              <form action={deleteSubgroupAction}><input type="hidden" name="id" value={g.id} /><button className="text-xs underline text-stone">Delete {g.name}</button></form>
                            </li>
                          ))}
                        </ul>
                        <form action={addSubgroupAction} className="mt-3 flex gap-3">
                          <input type="hidden" name="sport" value={s.slug} />
                          <input type="hidden" name="sub" value={c.slug} />
                          <input name="name" required placeholder={`New subgroup in ${c.name}`} className="field max-w-xs" aria-label={`New subgroup in ${c.name}`} />
                          <button className="btn btn-ghost">Add subgroup</button>
                        </form>
                      </details>
                    </li>
                  ))}
                </ul>
                <form action={addSubAction} className="mt-4 flex gap-3">
                  <input type="hidden" name="sport" value={s.slug} />
                  <input name="name" required placeholder="New subcategory name" className="field max-w-xs" aria-label="New subcategory" />
                  <button className="btn btn-ghost">Add</button>
                </form>
              </div>
              <div>
                <p className="eyebrow">Competitions, leagues or teams (the logo row on the category page)</p>
                <p className="mt-1 max-w-2xl text-xs text-stone">A competition only appears on the site once at least one published product is assigned to it (product page, or the <code>competition</code> column in the bulk import). Add a logo link only if you have the right to use it; without one the site shows the name.</p>
                <ul className="mt-3 space-y-2">
                  {allComps.filter((c) => c.sportSlug === s.slug).map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3">
                      <form action={saveCompetitionAction} className="flex w-full flex-wrap items-start gap-3 border-l-2 border-line pl-3">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="name" defaultValue={c.name} required className="field w-52" aria-label="Competition name" />
                        <input name="logo_url" defaultValue={c.logoUrl} placeholder="Logo link (https://… or /uploads/…)" className="field w-72" aria-label="Logo link" />
                        <input name="sort" type="number" defaultValue={c.sort} className="field w-20" aria-label="Order" />
                        <label className="flex h-12 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} /> Show</label>
                        <button className="btn btn-ghost !px-4 !py-2 text-xs">Save</button>
                      </form>
                      <form action={deleteCompetitionAction}><input type="hidden" name="id" value={c.id} /><button className="text-xs underline text-stone">Delete</button></form>
                    </li>
                  ))}
                </ul>
                <form action={addCompetitionAction} className="mt-4 flex gap-3">
                  <input type="hidden" name="sport" value={s.slug} />
                  <input name="name" required placeholder="New competition or team" className="field max-w-xs" aria-label="New competition" />
                  <button className="btn btn-ghost">Add</button>
                </form>
              </div>
              <form action={deleteSportAction}><input type="hidden" name="slug" value={s.slug} /><button className="text-xs underline text-stone">Delete this category (only if it has no products)</button></form>
            </div>
          </details>
        ))}
      </div>
      <h2 className="eyebrow mt-10">Add a category</h2>
      <form action={addSportAction} className="mt-4 flex gap-3">
        <input name="name" required placeholder="e.g. Cricket" className="field max-w-xs" aria-label="New category" />
        <button className="btn btn-primary">Add category</button>
      </form>
    </div>
  );
}
