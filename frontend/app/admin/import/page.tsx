import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { SIZES } from "@/lib/config";
import { listSportsAdmin } from "@/lib/categories";
import { ImportForm } from "./ImportForm";
import { Flash } from "@/components/AdminBits";
import { bulkImagesAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <div>
      <h1 className="display text-5xl">Bulk product import</h1>
      <p className="mt-4 max-w-2xl text-sm text-stone">
        Upload one CSV or Excel (.xlsx) file to add or update many products. Always press “Check file” first: it shows exactly what will be created or changed and saves nothing. Blank optional cells (description, image, stock) never erase what is already saved. Rows with an existing <code>slug</code> are updated; new slugs are created. Each clothing product gets six sizes ({SIZES.join(", ")}); one-size categories such as Caps get a single size (use the stock_ONE column). SKUs are named
        from <code>sku_prefix</code>, for example <code>NBA-SMP-XL</code>. Stock columns set the ready stock on hand. If any row is invalid, nothing is imported.
      </p>
      <p className="mt-4"><a href="/admin/template" className="btn btn-ghost">Download CSV template</a></p>
      <ul className="mt-6 max-w-2xl space-y-1 text-sm text-stone">
        <li><strong className="text-ink">sport</strong> must be one of: {(await listSportsAdmin()).map((s) => s.slug).join(", ")}</li>
        <li><strong className="text-ink">preorder_enabled</strong>: yes or no. Yes allows pre-order for every size, S to 3XL.</li>
        <li><strong className="text-ink">image_url</strong>: optional. Upload images on each product page, or paste a full https:// image URL.</li>
      </ul>
      <li className="mt-1 max-w-2xl list-none space-y-1 text-sm text-stone">
        <p><strong className="text-ink">subcategory</strong> (optional): a subcategory of that sport, by name, for example Jerseys. Add new ones in Admin, Categories first.</p>
        <p><strong className="text-ink">customizable</strong>: yes lets customers choose sleeves, name and number and patches. <strong className="text-ink">weight_g</strong>: grams, used for postage.</p>
      </li>
      <ImportForm sports={(await listSportsAdmin()).map((x) => ({ slug: x.slug, name: x.name }))} />

      <h2 className="eyebrow mt-14">Bulk upload photos</h2>
      <div className="mt-2"><Flash ok={sp.ok} err={sp.err} /></div>
      <p className="mt-2 max-w-2xl text-sm text-stone">Name each photo after the product slug: <code>nba-sample-jersey.jpg</code> becomes the main photo, <code>nba-sample-jersey-2.jpg</code> and <code>-3</code> become extra photos. Up to 60 files, 4 MB each.</p>
      <form action={bulkImagesAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp" className="field max-w-md" />
        <button className="btn btn-primary">Upload photos</button>
      </form>
      <p className="mt-10 text-sm"><Link href="/admin/products" className="underline">Back to products</Link></p>
    </div>
  );
}
