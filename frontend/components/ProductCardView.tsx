import Link from "next/link";
import type { BrowseProduct } from "@/lib/browse";
import { formatLkr } from "@/lib/format";
import { Tilt } from "./Tilt";
import { CapIcon } from "./CapIcon";

/** Presentational product card. No server-only imports, so both server pages and the client catalogue browser can use it. */
export function ProductCardView({ product, priority = false }: { product: BrowseProduct; priority?: boolean }) {
  const badge = product.badge;
  const orderable = product.sizes.filter((s) => s.mode !== "soldout");
  const showSizes = product.sizes.length > 1 && orderable.length > 0;
  return (
    <div data-depth className="h-full"><Tilt className="h-full"><article className="group flex h-full flex-col">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-mist">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} loading={priority ? "eager" : "lazy"} decoding="async" width={600} height={800} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          ) : product.sportSlug === "caps" ? (
            <CapIcon className="absolute inset-0 m-auto h-1/4 text-line transition duration-500 group-hover:scale-105 group-hover:text-accent" />
          ) : (
            <svg viewBox="0 0 100 120" className="absolute inset-0 m-auto h-1/2 text-line transition duration-500 group-hover:scale-105 group-hover:text-accent" fill="currentColor" aria-hidden="true">
              <path d="M32 10l-24 14 8 22 12-4v68h48V42l12 4 8-22-24-14c-3 8-10 12-18 12s-15-4-18-12z" />
            </svg>
          )}
          <span className={`eyebrow absolute left-0 top-4 px-3 py-1.5 ${badge === "Ready stock" ? "bg-ink text-paper" : badge === "Pre-order" ? "bg-accent text-ink" : "bg-paper text-stone"}`}>
            {badge}
          </span>
          {product.isDemo && <span className="absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-stone">Demo product</span>}
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-[13px] font-semibold uppercase leading-5 tracking-wide group-hover:text-accent-dark sm:mt-4 sm:text-sm">{product.name}</h3>
      </Link>
      <div className="mt-auto pt-1">
        <p className="truncate text-xs text-stone">{product.type} · {product.version}</p>
        <p className="mt-2 text-sm font-semibold">{formatLkr(product.priceLkr)}</p>
        {showSizes && (
          <p className="mt-1 truncate text-[11px] text-stone" aria-label={`Sizes: ${orderable.map((s) => s.size).join(", ")}`}>
            {orderable.map((s, i) => (
              <span key={s.size} className={s.mode === "ready" ? "font-medium text-ink" : ""}>{i > 0 ? " · " : ""}{s.size}</span>
            ))}
          </p>
        )}
      </div>
    </article></Tilt></div>
  );
}
