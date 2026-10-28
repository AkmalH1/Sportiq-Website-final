import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { ProductGrid } from "@/components/ProductGrid";
import { listProducts } from "@/lib/catalogue";
import { getCollection, type Collection } from "@/lib/content";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  return { title: c?.name ?? "Collection", description: c?.blurb || undefined };
}

async function Inner({ c }: { c: Collection }) {
  // A collection lists products whose Type contains its match word, or the whole catalogue when no word is set.
  const all = await listProducts();
  const word = c.match.toLowerCase();
  const items = word ? all.filter((p) => p.type.toLowerCase().includes(word) || p.name.toLowerCase().includes(word)) : all;
  return (
    <PageShell eyebrow="Collection" title={c.name}>
      <ProductGrid products={items} />
    </PageShell>
  );
}

export default async function CollectionPage({ params }: Props) {
  // Look the collection up before streaming starts so a missing one returns a real 404, not a soft 200.
  const c = await getCollection((await params).slug);
  if (!c) notFound();
  return <Suspense fallback={<div className="mx-auto max-w-[1400px] px-4 py-16"><div className="h-20 w-2/3 animate-pulse bg-mist" /></div>}><Inner c={c} /></Suspense>;
}
