import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { ProductPurchase } from "@/components/ProductPurchase";
import { ProductGallery } from "@/components/ProductGallery";
import { getProductBySlug, sizeStates } from "@/lib/catalogue";
import { formatLkr } from "@/lib/format";
import { getSettings, optionPrices } from "@/lib/settings";
import { versionsOffered } from "@/lib/options";
import Link from "next/link";
import { chartFor } from "@/lib/sizechart-server";
import { ReviewList } from "@/components/ReviewList";
import { listApproved } from "@/lib/reviews";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  return { title: p ? p.name : "Product", description: p?.description || undefined };
}

async function Inner({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  return (
    <PageShell eyebrow={`${p.type} · ${p.version}`} title={p.name}>
      <div className="grid items-start gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery name={p.name} images={[p.imageUrl, ...p.gallery].filter((u, n, all) => u && all.indexOf(u) === n)} demo={p.isDemo} />
        <div className="md:pt-2">
          <p className="text-3xl font-semibold">{formatLkr(p.priceLkr)}</p>
          {p.description && <p className="mt-4 max-w-md whitespace-pre-line text-[15px] leading-7 text-stone">{p.description}</p>}
          <p className="mt-6 max-w-md border-l-2 border-line pl-3 text-xs text-stone">Imported A-grade product. Not official or licensed merchandise, and not endorsed by any team, league or brand. <Link href="/disclaimer" className="underline">Copyright notice</Link></p>
          <div className="mt-8">
            <ProductPurchase slug={p.slug} name={p.name} price={p.priceLkr} sizes={sizeStates(p)} preorderEnabled={p.preorderEnabled} eta={p.preorderEta} customizable={p.customizable} prices={optionPrices(await getSettings())} showVersion={p.sportSlug === "football"} versions={versionsOffered(p.version)} chart={await chartFor(p.sportSlug, p.subcategorySlug)} />
          </div>
        </div>
      </div>
      <section className="mt-24" aria-labelledby="rev-h">
        <div className="flex items-end justify-between gap-6 border-b border-line pb-4">
          <h2 id="rev-h" className="display text-4xl">Reviews</h2>
          <Link href={`/reviews?product=${p.slug}`} className="eyebrow inline-flex min-h-11 items-center border-b border-ink hover:text-accent-dark">Write a review</Link>
        </div>
        <div className="mt-8"><ReviewList reviews={await listApproved({ product: p.slug, limit: 6 })} /></div>
      </section>
    </PageShell>
  );
}

export default async function ProductPage(props: Props) {
  // Check the product exists before streaming starts so an unknown slug returns a real 404.
  if (!(await getProductBySlug((await props.params).slug))) notFound();
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1400px] px-4 py-16"><div className="h-20 w-2/3 animate-pulse bg-mist" /></div>}>
      <Inner {...props} />
    </Suspense>
  );
}
