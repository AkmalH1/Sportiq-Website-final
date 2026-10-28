import Link from "next/link";
import { Flash } from "@/components/AdminBits";
import { ProductAdminForm } from "@/components/ProductAdminForm";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireAdmin();
  const { err } = await searchParams;
  return (
    <div>
      <Link href="/admin/products" className="eyebrow text-stone hover:text-ink">← Products</Link>
      <h1 className="display mt-3 text-5xl">Add product</h1>
      <div className="mt-8"><Flash err={err} /><ProductAdminForm /></div>
    </div>
  );
}
