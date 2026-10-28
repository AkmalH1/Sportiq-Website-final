import { Flash } from "@/components/AdminBits";
import { requireAdmin } from "@/lib/admin-auth";
import { listBanners } from "@/lib/catalogue";
import type { Banner } from "@/lib/types";
import { deleteBannerAction, saveBannerAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminBanners({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const banners = await listBanners(undefined, true);
  return (
    <div>
      <h1 className="display text-5xl">Banners</h1>
      <p className="mt-4 max-w-2xl text-sm text-stone">The first active <strong>hero</strong> banner is the top of the homepage. <strong>Slider</strong> banners appear in the campaign slider, in sort order. Upload a wide image (about 2400×1200) or leave it empty to use the two colours.</p>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <div className="space-y-6">
        {banners.map((b) => (
          <details key={b.id} className="border border-line">
            <summary className="flex cursor-pointer items-center justify-between p-4">
              <span><span className="eyebrow mr-3 text-accent-dark">{b.position}</span><strong>{b.title}</strong>{!b.active && <span className="ml-3 text-xs text-stone">hidden</span>}</span>
              <span className="text-xs text-stone">Edit</span>
            </summary>
            <div className="border-t border-line p-4"><BannerForm banner={b} /></div>
          </details>
        ))}
      </div>
      <h2 className="eyebrow mt-12">Add a banner</h2>
      <div className="mt-4 border border-line p-4"><BannerForm /></div>
    </div>
  );
}

function BannerForm({ banner }: { banner?: Banner }) {
  const f = (k: string, label: string, v?: string | number, extra = "") => (
    <label className={`block ${extra}`}><span className="eyebrow mb-2 block text-stone">{label}</span><input name={k} defaultValue={v} className="field" /></label>
  );
  return (
    <form action={saveBannerAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={banner?.id ?? ""} />
      <input type="hidden" name="image_url" value={banner?.imageUrl ?? ""} />
      <label className="block"><span className="eyebrow mb-2 block text-stone">Position</span>
        <select name="position" defaultValue={banner?.position ?? "slider"} className="field"><option value="slider">Slider</option><option value="hero">Hero</option></select>
      </label>
      {f("sort", "Sort order (low first)", banner?.sort ?? 0)}
      {f("eyebrow", "Small label", banner?.eyebrow)}
      {f("title", "Title", banner?.title)}
      <label className="block sm:col-span-2"><span className="eyebrow mb-2 block text-stone">Text</span><textarea name="body" rows={2} defaultValue={banner?.body} className="field" /></label>
      {f("cta_label", "Button text", banner?.ctaLabel)}
      {f("cta_href", "Button link (/shop or https://…)", banner?.ctaHref ?? "/shop")}
      {f("from_color", "Colour 1 (#111111)", banner?.fromColor ?? "#111111")}
      {f("to_color", "Colour 2 (#f4720a)", banner?.toColor ?? "#f4720a")}
      <label className="block sm:col-span-2"><span className="eyebrow mb-2 block text-stone">Image (JPG, PNG, WebP, max 4 MB)</span>
        {banner?.imageUrl && (
          <span className="mb-2 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt="" className="h-16 w-32 object-cover" />
            <span className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove_image" /> Remove image</span>
          </span>
        )}
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="field" />
      </label>
      <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={banner ? banner.active : true} /> Show on the store</label>
      <div className="flex gap-3 sm:col-span-2">
        <button className="btn btn-primary">{banner ? "Save banner" : "Add banner"}</button>
        {banner && <button className="btn btn-ghost" formAction={deleteBannerAction}>Delete</button>}
      </div>
    </form>
  );
}
