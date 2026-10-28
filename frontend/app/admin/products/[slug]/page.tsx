import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/AdminBits";
import { ProductAdminForm } from "@/components/ProductAdminForm";
import { requireAdmin } from "@/lib/admin-auth";
import { getProductBySlug } from "@/lib/catalogue";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; err?: string }> };

export default async function EditProduct({ params, searchParams }: Props) {
  await requireAdmin();
  const { slug } = await params;
  const sp = await searchParams;
  const p = await getProductBySlug(slug, true);
  if (!p) notFound();
  const prefix = p.variants[0]?.sku.replace(/-(S|M|L|XL|2XL|3XL)$/, "") ?? "";
  return (
    <div>
      <Link href="/admin/products" className="eyebrow text-stone hover:text-ink">← Products</Link>
      <h1 className="display mt-3 text-5xl">{p.name}</h1>
      <p className="mt-2 text-sm text-stone"><Link href={`/products/${p.slug}`} className="underline">View on the store</Link></p>
      <div className="mt-8"><Flash ok={sp.ok} err={sp.err} /><ProductAdminForm product={p} prefix={prefix} /></div>
    </div>
  );
}
