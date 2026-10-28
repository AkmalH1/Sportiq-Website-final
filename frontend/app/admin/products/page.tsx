import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listProducts } from "@/lib/catalogue";
import { SIZES } from "@/lib/config";
import { formatLkr } from "@/lib/format";
import { Flash } from "@/components/AdminBits";
import { SelectAllBox } from "@/components/SelectAllBox";
import { bulkProductsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const products = await listProducts({ includeUnpublished: true });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Products</h1>
        <div className="flex gap-3">
          <Link href="/admin/import" className="btn btn-ghost">Bulk import</Link>
          <Link href="/admin/products/new" className="btn btn-primary">Add product</Link>
        </div>
      </div>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <form action={bulkProductsAction} className="mt-6">
      <div className="flex flex-wrap items-center gap-3 border border-line p-3 text-sm">
        <span className="eyebrow">With ticked products</span>
        <button name="intent" value="publish" className="btn btn-ghost !px-4 !py-2 text-xs">Publish</button>
        <button name="intent" value="hide" className="btn btn-ghost !px-4 !py-2 text-xs">Hide (draft)</button>
        <button name="intent" value="delete" className="btn btn-ghost !px-4 !py-2 text-xs">Delete ticked</button>
        <span className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="eyebrow">Bulk edit</span>
          <select name="version_choice" className="field !w-44 !py-2 text-xs" aria-label="Versions to offer" defaultValue="both">
            <option value="both">Fan &amp; Player Version</option><option value="fan">Fan Version only</option><option value="player">Player Version only</option>
          </select>
          <button name="intent" value="set_version" className="btn btn-ghost !px-4 !py-2 text-xs">Set versions</button>
          <input name="new_price" inputMode="numeric" placeholder="price LKR" className="field !w-28 !py-2 text-xs" aria-label="New price" />
          <button name="intent" value="set_price" className="btn btn-ghost !px-4 !py-2 text-xs">Set price</button>
          <button name="intent" value="custom_on" className="btn btn-ghost !px-4 !py-2 text-xs">Name/number/patches ON</button>
          <button name="intent" value="custom_off" className="btn btn-ghost !px-4 !py-2 text-xs">OFF</button>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <input name="confirm" placeholder="type DELETE" className="field !w-32 !py-2 text-xs" aria-label="Type DELETE to remove every product" />
          <button name="intent" value="delete_all" className="btn btn-ghost !px-4 !py-2 text-xs">Delete ALL products</button>
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="eyebrow border-b border-line text-stone">
            <tr><th className="py-3 pr-3"><SelectAllBox /></th><th className="py-3 pr-4">Product</th><th className="pr-4">Price</th><th className="pr-4">Version</th><th className="pr-4">Status</th><th className="pr-4">Pre-order</th>{SIZES.map((s) => <th key={s} className="pr-3">{s}</th>)}<th className="pr-3">One</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-3 pr-3"><input type="checkbox" name="slug" value={p.slug} aria-label={`Select ${p.name}`} /></td>
                <td className="py-3 pr-4"><Link href={`/admin/products/${p.slug}`} className="font-semibold underline">{p.name}</Link><div className="text-xs text-stone">{p.sportSlug}{p.isDemo ? " · demo" : ""}</div></td>
                <td className="pr-4">{formatLkr(p.priceLkr)}</td>
                <td className="pr-4">{p.version || "-"}</td>
                <td className="pr-4">{p.status}</td>
                <td className="pr-4">{p.preorderEnabled ? "Yes" : "No"}</td>
                {SIZES.map((s) => <td key={s} className="pr-3">{p.variants.find((v) => v.size === s)?.stock ?? "-"}</td>)}
                <td className="pr-3">{p.variants.find((v) => v.size === "One Size")?.stock ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </form>
    </div>
  );
}
