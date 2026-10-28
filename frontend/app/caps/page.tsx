import type { Metadata } from "next";
import Link from "next/link";
import { CapIcon } from "@/components/CapIcon";
import { Parallax, Reveal } from "@/components/Motion";
import { ProductCard } from "@/components/ProductCard";
import { listProducts } from "@/lib/catalogue";
import { listSportsAdmin } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Caps", description: "Fitted, snapback and adjustable caps and beanies from the leagues you follow." };

type SP = { style?: string; league?: string; sort?: string; stock?: string };

export default async function Caps({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const all = await listSportsAdmin();
  const caps = all.find((s) => s.slug === "caps");
  const styles = (caps?.subs ?? []).filter((s) => s.active);
  const leagues = all.filter((s) => s.slug !== "caps" && s.active);
  const style = styles.find((s) => s.slug === sp.style || s.name === sp.style);
  const league = leagues.find((s) => s.slug === sp.league);

  let products = await listProducts({ sport: "caps", sub: style?.slug, league: league?.slug });
  if (sp.stock === "ready") products = products.filter((p) => p.variants.some((v) => v.stock > 0));
  if (sp.sort === "low") products = [...products].sort((a, b) => a.priceLkr - b.priceLkr);
  else if (sp.sort === "high") products = [...products].sort((a, b) => b.priceLkr - a.priceLkr);

  const href = (patch: Partial<SP>) => {
    const next: SP = { ...sp, ...patch };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/caps?${s}` : "/caps";
  };
  const chip = (on: boolean) => `eyebrow inline-flex min-h-11 items-center whitespace-nowrap border px-4 py-2.5 transition ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink"}`;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-paper">
        <Parallax speed={0.25} className="pointer-events-none absolute inset-0 -z-10">
          <CapIcon className="absolute -right-10 top-4 h-[26rem] w-[46rem] text-white/10 md:right-10 md:h-[34rem] md:w-[60rem]" />
          <CapIcon className="absolute -left-24 bottom-[-6rem] h-72 w-[30rem] -rotate-12 text-accent/30" />
        </Parallax>
        <div className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10 lg:py-36">
          <p className="eyebrow text-accent">Headwear</p>
          <h1 className="display mt-3 text-[5.5rem] leading-[0.85] md:text-[13rem]">Caps</h1>
          <p className="mt-6 max-w-md text-white/75">Fitted, snapback, adjustable and beanies from the leagues you follow. One size, ready stock or pre-order.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#grid" className="btn border-accent bg-accent text-ink hover:border-paper hover:bg-paper">Shop all caps</a>
            <Link href="/help/pre-orders" className="btn border-white/40 text-paper hover:bg-paper hover:text-ink">How pre-orders work</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-16 lg:px-10" aria-labelledby="styles-h">
        <h2 id="styles-h" className="display text-4xl md:text-5xl">Shop by style</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {styles.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={i * 60}>
                <Link href={href({ style: style?.slug === s.slug ? undefined : s.slug })} scroll={false}
                  className={`group flex h-full flex-col items-center justify-center gap-3 border p-6 text-center transition ${style?.slug === s.slug ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
                  <CapIcon className="h-12 w-24 transition group-hover:scale-110 group-hover:text-accent" />
                  <span className="display text-2xl">{s.name}</span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-16 lg:px-10" aria-labelledby="league-h">
        <h2 id="league-h" className="display text-4xl md:text-5xl">Shop by league</h2>
        <ul className="-mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {leagues.map((l) => (
            <li key={l.slug} className="shrink-0">
              <Link href={href({ league: league?.slug === l.slug ? undefined : l.slug })} scroll={false}
                className={`flex h-24 w-40 flex-col justify-between p-4 text-paper transition hover:-translate-y-0.5 ${league?.slug === l.slug ? "ring-2 ring-accent ring-offset-2" : ""}`}
                style={{ background: `linear-gradient(150deg, #111 20%, ${l.accent})` }}>
                <span className="eyebrow text-white/60">League</span>
                <span className="display text-3xl">{l.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="grid" className="mx-auto max-w-[1400px] scroll-mt-4 px-4 py-16 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
          <p className="text-sm text-stone"><strong className="text-ink">{products.length}</strong> cap{products.length === 1 ? "" : "s"}{style && ` · ${style.name}`}{league && ` · ${league.name}`}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href({ stock: sp.stock === "ready" ? undefined : "ready" })} scroll={false} className={chip(sp.stock === "ready")}>Ready stock only</Link>
            <Link href={href({ sort: undefined })} scroll={false} className={chip(!sp.sort)}>Newest</Link>
            <Link href={href({ sort: "low" })} scroll={false} className={chip(sp.sort === "low")}>Price low to high</Link>
            <Link href={href({ sort: "high" })} scroll={false} className={chip(sp.sort === "high")}>Price high to low</Link>
            {(style || league || sp.stock || sp.sort) && <Link href="/caps" className="text-xs underline text-stone">Clear all</Link>}
          </div>
        </div>

        {products.length > 0 ? (
          <ul className="pgrid mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p, i) => <li key={p.slug}><Reveal delay={(i % 5) * 50}><ProductCard product={p} /></Reveal></li>)}
          </ul>
        ) : (
          <div className="mt-10 border border-dashed border-line bg-mist p-12 text-center">
            <p className="font-semibold">No caps match these filters</p>
            <p className="mt-1 text-sm text-stone">Try another style or league, or <Link href="/caps" className="underline">clear the filters</Link>.</p>
          </div>
        )}
      </section>
    </>
  );
}
