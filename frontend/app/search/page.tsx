import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { ProductGrid } from "@/components/ProductGrid";
import { listProducts } from "@/lib/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };
type Props = { searchParams: Promise<{ q?: string }> };

async function Inner({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  return (
    <PageShell eyebrow="Search" title={term ? `Results for "${term}"` : "Search"}>
      <form action="/search" role="search" className="mb-12 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">Search products</label>
        <input id="q" name="q" defaultValue={term} placeholder="Barcelona, NBA, polo" className="field flex-1" />
        <button className="btn btn-primary">Search</button>
      </form>
      <ProductGrid products={await listProducts({ q: term || undefined })} />
    </PageShell>
  );
}

export default function Search(props: Props) {
  return <Suspense fallback={<div className="mx-auto max-w-[1400px] px-4 py-16"><div className="h-20 w-2/3 animate-pulse bg-mist" /></div>}><Inner {...props} /></Suspense>;
}
