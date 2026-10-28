import type { Product } from "@/lib/types";
import { toBrowse } from "@/lib/catalogue";
import { ProductCardView } from "./ProductCardView";

export function ProductCard({ product }: { product: Product }) {
  return <ProductCardView product={toBrowse(product)} />;
}
