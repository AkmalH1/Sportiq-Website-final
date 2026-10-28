import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CatalogueBrowser } from "@/components/CatalogueBrowser";
import { SportArt } from "@/components/SportArt";
import { listProducts, toBrowse } from "@/lib/catalogue";
import { getSport, listSportsAdmin } from "@/lib/categories";
import { listNavCompetitions } from "@/lib/competitions";
import { listSubgroups } from "@/lib/subgroups";
import { parseFilters, sanitizeFilters } from "@/lib/browse";
import { SIZES, ONE_SIZE } from "@/lib/config";
import "@/app/home.css";

export const dynamic = "force-dynamic";
type SP = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const sport = await getSport(slug);
  const name = sport?.name ?? "Sport";
  const comp = typeof sp.comp === "string" ? (await listNavCompetitions(slug)).find((c) => c.slug === sp.comp) : undefined;
  const title = comp ? `${comp.name} ${name}` : name;
  return {
    title,
    description: sport?.tagline ? `${title}: ${sport.tagline}. Ready stock and pre-order from SPORTIQ.` : undefined,
    alternates: { canonical: `/sports/${slug}${comp ? `?comp=${comp.slug}` : ""}` },
  };
}

async function Inner({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  if (slug === "caps") redirect(typeof sp.type === "string" && sp.type ? `/caps?style=${encodeURIComponent(sp.type)}` : "/caps");
  const sport = await getSport(slug);
  if (!sport) notFound();
  const subs = (await listSportsAdmin()).find((s) => s.slug === slug)?.subs.filter((c) => c.active) ?? [];
  const [products, comps] = await Promise.all([listProducts({ sport: slug }), listNavCompetitions(slug)]);
  const browse = products.map(toBrowse);
  // A subgroup is offered once a published product is in it. Its brands are all shown (brands without products are greyed out).
  const groups = (await listSubgroups(slug)).filter((g) => browse.some((p) => p.grp === g.slug));

  // Only offer sub-categories that actually contain products, so no filter ever leads to an empty page.
  const usedSubs = subs.filter((c) => browse.some((p) => p.sub === c.slug)).map((c) => ({ slug: c.slug, name: c.name }));
  const raw = parseFilters(sp);
  const legacy = subs.find((c) => c.name === raw.sub); // old links used the subcategory name
  const sizeOrder = [...SIZES, ONE_SIZE];
  const initial = sanitizeFilters(legacy ? { ...raw, sub: legacy.slug } : raw, {
    comps: comps.map((c) => c.slug), subs: usedSubs.map((s) => s.slug),
    groups: groups.map((g) => ({ slug: g.slug, sub: g.subSlug, brands: g.brands.map((b) => b.slug) })),
    sizes: [...new Set(browse.flatMap((p) => p.sizes.filter((s) => s.mode !== "soldout").map((s) => s.size)))],
  });

  return (
    <>
      <header className="relative isolate overflow-hidden bg-ink text-paper">
        <div className="mx-auto flex max-w-[1400px] items-end justify-between gap-6 px-4 py-8 sm:py-16 lg:px-10">
          <div className="min-w-0">
            <p className="eyebrow text-accent">{sport.tagline}</p>
            <h1 className="display mt-3 text-5xl sm:text-7xl md:text-8xl">{sport.name}</h1>
            <p className="mt-4 text-sm text-white/75">{browse.length} product{browse.length === 1 ? "" : "s"}{comps.length > 0 && <> · {comps.length} {comps.length === 1 ? "competition" : "competitions"}</>}</p>
          </div>
          <SportArt slug={slug} className="hero-art" />
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 lg:px-10">
        {browse.length === 0 ? (
          <div className="border border-dashed border-line bg-mist p-12 text-center">
            <p className="font-semibold">Nothing here yet</p>
            <p className="mt-1 text-sm text-stone">New {sport.name.toLowerCase()} products are added regularly. Check back soon, or browse the other sports.</p>
          </div>
        ) : (
          <CatalogueBrowser
            sport={slug} sportName={sport.name} basePath={`/sports/${slug}`} products={browse}
            comps={comps.map((c) => ({ slug: c.slug, name: c.name, logoUrl: c.logoUrl, count: c.count }))}
            subs={usedSubs} groups={groups.map((g) => ({ slug: g.slug, sub: g.subSlug, name: g.name, brands: g.brands }))} sizeOrder={sizeOrder} initial={initial}
          />
        )}
      </div>
    </>
  );
}

export default function SportPage(props: Props) {
  return <Suspense fallback={<div className="mx-auto max-w-[1400px] px-4 py-16"><div className="h-20 w-2/3 animate-pulse bg-mist" /></div>}><Inner {...props} /></Suspense>;
}
