"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";
import { Parallax } from "./Motion";
import { Scene3D } from "./Scene3D";

const FALLBACK: Banner = {
  id: 0, position: "hero", sort: 0, eyebrow: "Sportswear for Sri Lanka", title: "Wear your game.", body: "", ctaLabel: "Shop now", ctaHref: "/shop",
  fromColor: "#111111", toColor: "#f4720a", imageUrl: "", active: true,
};

/**
 * Premium top of the home page. Every active "hero" banner becomes a slide (photo, headline, text, button), so the owner can rotate
 * several licensed photos. A banner without a photo shows the original 3D artwork instead.
 */
export function Hero({ banners, watermark, cta2Label, cta2Href, ticker, photoNote }: {
  banners: Banner[]; watermark: string; cta2Label: string; cta2Href: string; ticker: string[]; photoNote: string;
}) {
  const slides = banners.length ? banners : [FALLBACK];
  const n = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [paused, n]);

  const b = slides[i] ?? slides[0];
  const words = b.title.split(" ");
  const last = words.pop();
  const items = ticker.length ? ticker : [];

  return (
    <section aria-roledescription={n > 1 ? "carousel" : undefined} aria-label="Featured"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      className="relative isolate overflow-hidden bg-ink text-paper">
      <div className="hero-box relative">
        {/* Backgrounds crossfade; the colour wash always sits underneath so a slow photo never shows a blank frame. */}
        {slides.map((s, k) => (
          <div key={s.id + ":" + k} aria-hidden="true" className={`absolute inset-0 -z-20 transition-opacity duration-1000 motion-reduce:transition-none ${k === i ? "opacity-100" : "opacity-0"}`}>
            <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${s.fromColor} 35%, ${s.toColor} 150%)` }} />
            {s.imageUrl && (
              <Parallax speed={0.18} className="absolute inset-x-0 -top-[10%] h-[120%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt="" fetchPriority={k === 0 ? "high" : "low"} loading={k === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover object-[70%_20%]" />
              </Parallax>
            )}
          </div>
        ))}
        {/* Legibility: the text side is always darker than the photo side. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-transparent md:from-black/80 md:via-black/30" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
        <Parallax speed={-0.1} className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-4 top-0 h-[140%] w-px bg-white/10 lg:left-10" />
          <div className="absolute right-[18%] top-0 h-[140%] w-px bg-accent/50" />
        </Parallax>
        <Parallax speed={0.12} className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 select-none overflow-hidden">
          <p className="display whitespace-nowrap text-[24vw] leading-none text-white/[0.05]" aria-hidden="true">{watermark}</p>
        </Parallax>
        {!b.imageUrl && (
          <>
            <div aria-hidden="true" className="hero-glow -z-10" />
            <Scene3D className="hero-scene -z-10" />
          </>
        )}

        <div className="hero-inner relative mx-auto flex max-w-[1400px] flex-col justify-center px-4 py-16 md:py-24 lg:px-10">
          <div key={b.id + ":" + i} className="hero-copy max-w-3xl">
            <p className="eyebrow flex items-center gap-3 text-accent"><span aria-hidden="true" className="h-px w-10 bg-accent" />{b.eyebrow}</p>
            <h1 className="display hero-title mt-6">
              {words.join(" ")} <span className="text-accent">{last}</span>
            </h1>
            {b.body && <p className="mt-6 max-w-md text-base text-white/80 md:text-lg">{b.body}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              {b.ctaLabel && <Link href={b.ctaHref} className="btn border-accent bg-accent text-ink hover:border-paper hover:bg-paper">{b.ctaLabel}</Link>}
              {cta2Label && <Link href={cta2Href || "/help/pre-orders"} className="btn border-white/50 text-paper hover:bg-paper hover:text-ink">{cta2Label}</Link>}
            </div>
          </div>

          {!b.imageUrl && (
            <div className="relative mt-10 md:hidden">
              <Scene3D interactive className="mx-auto h-[280px] w-full max-w-[340px]" />
              <p className="eyebrow mt-1 text-center text-white/50">Drag to spin</p>
            </div>
          )}

          {n > 1 && (
            <div className="mt-10 flex items-center gap-2" role="tablist" aria-label="Choose banner">
              {slides.map((s, k) => (
                <button key={s.id + ":" + k} type="button" role="tab" aria-selected={k === i} aria-label={`Show banner ${k + 1} of ${n}`} onClick={() => setI(k)} className="group flex h-11 items-center px-0.5">
                  <span className={`block h-0.5 transition-all ${k === i ? "w-12 bg-accent" : "w-6 bg-white/40 group-hover:bg-white/70"}`} />
                </button>
              ))}
            </div>
          )}
          {photoNote && b.imageUrl && <p className="mt-6 text-[11px] uppercase tracking-widest text-white/50">{photoNote}</p>}
        </div>
      </div>

      {items.length > 0 && (
        <div className="relative overflow-hidden border-y border-white/15 bg-black/60 py-3 backdrop-blur" aria-label="Highlights">
          <div className="ticker-track flex w-max whitespace-nowrap" aria-hidden="false">
            {[0, 1].map((rep) => (
              <ul key={rep} className="flex shrink-0" aria-hidden={rep === 1}>
                {items.map((t) => (
                  <li key={t} className="eyebrow flex items-center px-6 text-white/80">{t}<span aria-hidden="true" className="ml-12 text-accent">◆</span></li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
