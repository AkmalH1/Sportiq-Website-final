import Link from "next/link";
import type { Faq, Product, Sport } from "@/lib/types";
import { Parallax, Reveal } from "./Motion";
import { Tilt } from "./Tilt";
import { Coverflow } from "./Coverflow";
import { SportTile } from "./SportTile";
import { CapIcon } from "./CapIcon";
import { ProductCard } from "./ProductCard";
import { ReviewList } from "./ReviewList";
import type { Review } from "@/lib/reviews";
import type { SiteTexts } from "@/lib/site-text";
import { textLines } from "@/lib/site-text-defs";
import { formatLkr } from "@/lib/format";

export function SectionHead({ id, eyebrow, title, action }: { id: string; eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="depth-scroll flex items-end justify-between gap-6 border-b border-line pb-6">
      <div>
        <p className="eyebrow text-accent-dark">{eyebrow}</p>
        <h2 id={id} className="display mt-3 text-4xl md:text-6xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function SportGrid({ sports, t }: { sports: Sport[]; t: SiteTexts }) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10" aria-labelledby="sports-h">
      <SectionHead id="sports-h" eyebrow={t["home.sports.eyebrow"]} title={t["home.sports.title"]} />
      <div className="md:hidden">
        <Coverflow label="Sports">
          {[...sports.map((s, i) => <SportTile key={s.slug} sport={s} index={i} />),
          <Link key="all" href="/shop" className="sport-tile-all flex items-center justify-center border border-ink bg-paper p-5 text-center"><span className="display text-5xl">{t["home.sports.viewall"]}</span></Link>]}
        </Coverflow>
        <p className="eyebrow text-center text-ink/50">Swipe</p>
      </div>
      <ul className="mt-12 hidden grid-cols-2 gap-4 md:grid md:grid-cols-4 md:gap-6">
        {sports.map((s, i) => (
          <li key={s.slug} className={i % 2 === 1 ? "md:mt-12" : ""}>
            <Reveal delay={(i % 4) * 80}>
              <Tilt max={12}>
              <SportTile sport={s} index={i} />
              </Tilt>
            </Reveal>
          </li>
        ))}
        <li className="md:mt-12">
          <Reveal delay={320}>
            <Link href="/shop" className="sport-tile-all group flex items-center justify-center border border-ink p-5 text-center hover:bg-ink hover:text-paper">
              <span className="display text-4xl md:text-5xl">{t["home.sports.viewall"]}</span>
            </Link>
          </Reveal>
        </li>
      </ul>
    </section>
  );
}

export function ManifestoBand({ t }: { t: SiteTexts }) {
  return (
    <section className="relative isolate overflow-hidden bg-accent text-ink">
      <Parallax speed={0.3} className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-0 h-[120%] w-[40%] -skew-x-12 bg-black/10" />
        <div className="absolute right-[10%] top-0 h-[120%] w-[8%] -skew-x-12 bg-black/10" />
      </Parallax>
      <div className="mx-auto max-w-5xl px-4 py-32 text-center lg:px-10">
        <Reveal>
          <p className="eyebrow">{t["home.manifesto.eyebrow"]}</p>
          <p className="display mt-8 text-5xl md:text-8xl">{t["home.manifesto.title"]}</p>
          {t["home.manifesto.body"] && <p className="mx-auto mt-8 max-w-lg text-base font-medium">{t["home.manifesto.body"]}</p>}
        </Reveal>
      </div>
    </section>
  );
}

export function StyleCards({ styles, t }: { styles: { slug: string; name: string; blurb: string; from: string; to: string }[]; t: SiteTexts }) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10" aria-labelledby="styles-h">
      <SectionHead id="styles-h" eyebrow={t["home.styles.eyebrow"]} title={t["home.styles.title"]} />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {styles.map((s, i) => (
          <li key={s.slug}>
            <Reveal delay={i * 80}>
              <Tilt max={8}><Link href={`/collections/${s.slug}`} className="group relative flex min-h-72 flex-col justify-end overflow-hidden p-6 text-paper" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}>
                <span className="display text-4xl">{s.name}</span>
                <span className="mt-1 text-sm text-white/80">{s.blurb}</span>
              </Link></Tilt>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CapsBand({ caps, t }: { caps: Product[]; t: SiteTexts }) {
  if (caps.length === 0) return null;
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper" aria-labelledby="caps-h">
      <Parallax speed={0.2} className="pointer-events-none absolute inset-0 -z-10">
        <CapIcon className="absolute -right-16 -top-10 h-[24rem] w-[42rem] text-white/10" />
      </Parallax>
      <div className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-accent">{t["home.caps.eyebrow"]}</p>
            <h2 id="caps-h" className="display mt-3 text-6xl md:text-9xl">{t["home.caps.title"]}</h2>
          </div>
          <Link href="/caps" className="btn border-accent bg-accent text-ink hover:border-paper hover:bg-paper">{t["home.caps.button"]}</Link>
        </div>
        <ul className="pgrid mt-12 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-10 md:grid-cols-4">
          {caps.slice(0, 4).map((p, i) => (
            <li key={p.slug} className="[&_a]:text-paper [&_p]:text-white/70 [&_h3]:text-paper"><Reveal delay={i * 70}><ProductCard product={p} /></Reveal></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LatestDrops({ products, t }: { products: Product[]; t: SiteTexts }) {
  const demo = products.some((p) => p.isDemo);
  return (
    <section className="bg-mist" aria-labelledby="drops-h">
      <div className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10">
        <SectionHead id="drops-h" eyebrow={t["home.drops.eyebrow"]} title={t["home.drops.title"]} action={<Link href="/shop" className="eyebrow border-b border-ink pb-1 hover:text-accent-dark">{t["home.drops.viewall"]}</Link>} />
        {demo && <p className="mt-6 inline-block bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-paper">Demo products. Replace via Admin, Products, bulk import.</p>}
        <ul className="pgrid mt-12 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 8).map((p, i) => (
            <li key={p.slug}><Reveal delay={(i % 4) * 70}><ProductCard product={p} /></Reveal></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PreorderExplainer({ t }: { t: SiteTexts }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper" aria-labelledby="pre-h">
      <Parallax speed={0.25} className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full border border-white/10" />
        <div className="absolute -right-20 top-30 h-[22rem] w-[22rem] rounded-full border border-accent/40" />
      </Parallax>
      <div className="mx-auto grid max-w-[1400px] gap-16 px-4 py-28 lg:grid-cols-2 lg:px-10">
        <Reveal>
          <p className="eyebrow text-accent">{t["home.pre.eyebrow"]}</p>
          <h2 id="pre-h" className="display mt-4 text-5xl md:text-7xl">{t["home.pre.title"]}</h2>
          {t["home.pre.body"] && <p className="mt-6 max-w-md text-white/70">{t["home.pre.body"]}</p>}
          <Link href="/help/pre-orders" className="btn mt-8 border-accent bg-accent text-ink hover:border-paper hover:bg-paper">{t["home.pre.button"]}</Link>
        </Reveal>
        <Reveal delay={120}>
          <ol className="relative border-l border-white/20 pl-8">
            {textLines(t["home.pre.stages"]).map((stage, i) => (
              <li key={stage} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[2.45rem] top-1 flex h-4 w-4 items-center justify-center bg-ink">
                  <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-accent" : "border border-white/50"}`} />
                </span>
                <p className="eyebrow text-white/50">Step {i + 1}</p>
                <p className="display text-2xl">{stage}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export function Reviews({ reviews, t }: { reviews: Review[]; t: SiteTexts }) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10" aria-labelledby="reviews-h">
      <SectionHead id="reviews-h" eyebrow={t["home.reviews.eyebrow"]} title={t["home.reviews.title"]} action={<Link href="/reviews" className="eyebrow border-b border-ink pb-1 hover:text-accent-dark">{t["home.reviews.link"]}</Link>} />
      <div className="mt-12"><ReviewList reviews={reviews.slice(0, 6)} /></div>
    </section>
  );
}

export function FaqSection({ faqs, t }: { faqs: Faq[]; t: SiteTexts }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-28 lg:px-10" aria-labelledby="faq-h">
      <SectionHead id="faq-h" eyebrow={t["home.faq.eyebrow"]} title={t["home.faq.title"]} />
      <div className="divide-y divide-line border-b border-line">
        {faqs.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer items-center justify-between gap-6 text-sm font-semibold uppercase tracking-wide">
              {f.q}
              <span className="text-xl font-light text-accent transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Home page promotion for gift cards and voucher codes. Numbers come from Settings, never from this file. */
export function GiftBand({ t, example, maxPercent }: { t: SiteTexts; example: { face: number; price: number } | null; maxPercent: number }) {
  const title = t["home.gift.title"].split("\n");
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper" aria-labelledby="gift-h">
      <Parallax speed={0.2} className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-8 h-[26rem] w-[26rem] rounded-full border border-accent/30" />
        <div className="absolute left-10 top-24 h-[16rem] w-[16rem] rounded-full border border-white/10" />
      </Parallax>
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <Reveal>
          <p className="eyebrow text-accent">{t["home.gift.eyebrow"]}</p>
          <h2 id="gift-h" className="display mt-4 text-5xl md:text-7xl">{title.map((l, i) => <span key={i} className="block">{l}</span>)}</h2>
          {t["home.gift.body"] && <p className="mt-6 max-w-md text-white/75">{t["home.gift.body"]}</p>}
          {maxPercent > 0 && <p className="mt-5 inline-block bg-accent px-3 py-2 text-sm font-semibold text-ink">Save up to {maxPercent}% when you buy</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/gift-cards" className="btn border-accent bg-accent text-ink hover:border-paper hover:bg-paper">{t["home.gift.button"]}</Link>
            <Link href="/gift-cards#how-h" className="btn border-white/50 text-paper hover:bg-paper hover:text-ink">How it works</Link>
          </div>
          {t["home.gift.voucher"] && <p className="mt-6 flex items-center gap-3 text-sm text-white/70"><span aria-hidden="true" className="eyebrow border border-accent px-2 py-1 text-accent">CODE</span>{t["home.gift.voucher"]}</p>}
        </Reveal>
        <Reveal delay={120}>
          <div aria-hidden="true" className="mx-auto w-full max-w-sm">
            <div className="gift-card-art">
              <p className="display text-3xl">SPORT<span className="text-accent">IQ</span></p>
              <p className="eyebrow absolute bottom-6 left-6 text-white/60">Gift card</p>
              <p className="display absolute bottom-5 right-6 text-4xl text-accent">{example ? formatLkr(example.face) : "LKR"}</p>
            </div>
            {example && example.price < example.face && <p className="eyebrow mt-6 text-center text-white/60">You pay {formatLkr(example.price)}</p>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
