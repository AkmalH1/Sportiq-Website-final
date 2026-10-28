import { listSportsAdmin } from "@/lib/categories";
import { listCompetitionsAdmin } from "@/lib/competitions";
import { listSubgroupsAdmin } from "@/lib/subgroups";
import { TaxonomyPicker } from "./TaxonomyPicker";
import { SIZES } from "@/lib/config";
import type { Product } from "@/lib/types";
import { saveProductAction } from "@/app/admin/actions";

export async function ProductAdminForm({ product, prefix }: { product?: Product; prefix?: string }) {
  const sports = await listSportsAdmin();
  const comps = await listCompetitionsAdmin();
  const groups = await listSubgroupsAdmin();
  const stock = (size: string) => product?.variants.find((v) => v.size === size)?.stock ?? 0;
  return (
    <form action={saveProductAction} className="grid max-w-3xl gap-5">
      <input type="hidden" name="original_slug" value={product?.slug ?? ""} />
      <input type="hidden" name="image_url" value={product?.imageUrl ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name"><input name="name" required defaultValue={product?.name} className="field" /></Field>
        <Field label="Price (LKR)"><input name="price_lkr" type="number" min={0} step={1} required defaultValue={product?.priceLkr} className="field" /></Field>
        <Field label="Sport">
          <select name="sport" defaultValue={product?.sportSlug ?? "football"} className="field">{sports.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select>
        </Field>
        <TaxonomyPicker
          subs={sports.flatMap((s) => s.subs.map((c) => ({ sport: s.slug, sportName: s.name, slug: c.slug, name: c.name })))}
          groups={groups.map((g) => ({ sport: g.sportSlug, sub: g.subSlug, slug: g.slug, name: g.name, brands: g.brands }))}
          sub={product?.subcategorySlug ?? ""} group={product?.subgroupSlug ?? ""} brand={product?.brandSlug ?? ""}
        />
        <Field label="Competition / league / team (for the logo row on the category page)">
          <select name="competition" defaultValue={product?.competitionSlug ?? ""} className="field">
            <option value="">None</option>
            {sports.filter((s) => comps.some((c) => c.sportSlug === s.slug)).map((s) => <optgroup key={s.slug} label={s.name}>{comps.filter((c) => c.sportSlug === s.slug).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</optgroup>)}
          </select>
        </Field>
        <Field label="Related league (caps only, for Shop by league)">
          <select name="league" defaultValue={product?.leagueSlug ?? ""} className="field">
            <option value="">None</option>
            {sports.filter((s) => s.slug !== "caps").map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Weight in grams (for postage)"><input name="weight_g" type="number" min={1} max={20000} defaultValue={product?.weightG ?? 400} className="field" /></Field>
        <Field label="Status">
          <select name="status" defaultValue={product?.status ?? "published"} className="field">{["published", "draft", "archived"].map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Type (e.g. Club Jersey)"><input name="type" defaultValue={product?.type} className="field" /></Field>
        <Field label="Version (e.g. Fan Version)"><input name="version" defaultValue={product?.version} className="field" /></Field>
        <Field label={product ? "SKU prefix (fixed)" : "SKU prefix (e.g. BAR-HOME)"}>
          <input name="sku_prefix" required readOnly={!!product} defaultValue={prefix} pattern="[A-Za-z0-9\-]{2,20}" className="field read-only:bg-mist" />
        </Field>
        {!product && <Field label="URL slug (optional)"><input name="slug" className="field" placeholder="made from the name" /></Field>}
      </div>
      <Field label="Description"><textarea name="description" rows={3} defaultValue={product?.description} className="field" /></Field>

      <fieldset className="border border-line p-5">
        <legend className="eyebrow px-2">Customisation</legend>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="customizable" defaultChecked={product?.customizable} /> Customer can choose long sleeves, name and number, and patches (use for football jerseys)</label>
      </fieldset>

      <fieldset className="border border-line p-5">
        <legend className="eyebrow px-2">Pre-order</legend>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="preorder_enabled" defaultChecked={product?.preorderEnabled} /> Allow pre-order for every size, S to 3XL, when ready stock runs out</label>
        <Field label="Estimated arrival text"><input name="preorder_eta" defaultValue={product?.preorderEta} placeholder="Arrives in 2 to 3 weeks" className="field mt-2" /></Field>
      </fieldset>

      <fieldset className="border border-line p-5">
        <legend className="eyebrow px-2">Ready stock on hand (clothing sizes)</legend>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {SIZES.map((s) => <Field key={s} label={s}><input name={`stock_${s}`} type="number" min={0} step={1} defaultValue={stock(s)} className="field" /></Field>)}
        </div>
      </fieldset>

      <fieldset className="border border-line p-5">
        <legend className="eyebrow px-2">Ready stock on hand (one size, for caps)</legend>
        <p className="mb-3 text-xs text-stone">Categories set to one size (such as Caps) use this single number and ignore S to 3XL.</p>
        <div className="max-w-[10rem]"><Field label="One size"><input name="stock_ONE" type="number" min={0} step={1} defaultValue={stock("One Size")} className="field" /></Field></div>
      </fieldset>

      <Field label="Product image (JPG, PNG or WebP, max 4 MB)">
        {product?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="mb-3 h-32 w-24 object-cover" />
        )}
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="field" />
      </Field>
      <Field label="More photos (up to 6 in total, JPG, PNG or WebP)">
        {!!product?.gallery.length && (
          <div className="mb-3 flex flex-wrap gap-3">
            {product.gallery.map((u) => (
              <label key={u} className="text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-24 w-20 object-cover" />
                <input type="checkbox" name="gallery_keep" value={u} defaultChecked /> keep
              </label>
            ))}
          </div>
        )}
        <input name="gallery_new" type="file" multiple accept="image/jpeg,image/png,image/webp" className="field" />
      </Field>
      <button className="btn btn-primary w-fit">{product ? "Save changes" : "Create product"}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow mb-2 block text-stone">{label}</span>{children}</label>;
}
