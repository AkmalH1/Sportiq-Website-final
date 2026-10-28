import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { EmptyState } from "./PageShell";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return <EmptyState title="No products found" body="Try another search or browse all sports." />;
  return (
    <ul className="pgrid grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.slug}><ProductCard product={p} /></li>
      ))}
    </ul>
  );
}
