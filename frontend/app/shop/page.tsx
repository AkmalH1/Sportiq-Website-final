import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ProductGrid } from "@/components/ProductGrid";
import { listProducts } from "@/lib/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop all" };

export default async function Shop() {
  return (
    <PageShell eyebrow="Catalogue" title="Shop all">
      <ProductGrid products={await listProducts()} />
    </PageShell>
  );
}
