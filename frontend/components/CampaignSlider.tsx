"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Banner } from "@/lib/types";
import { Parallax } from "./Motion";
import { SportArt, slugFromHref } from "./SportArt";

export function CampaignSlider({ slides }: { slides: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((i: number) => setIndex((i + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6500);
    return () => clearInterval(t);
  }, [paused, count]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Campaigns"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden">
        <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, i) => (
            <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i !== index}
              className="relative isolate flex min-h-[420px] w-full shrink-0 items-end overflow-hidden text-paper md:min-h-[560px]">
              <Parallax speed={0.2} className="absolute inset-x-0 -top-[12%] -z-10 h-[124%]">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${s.fromColor}, ${s.toColor})` }} />
                )}
              </Parallax>
              {!s.imageUrl && <SportArt slug={slugFromHref(s.ctaHref)} className="campaign-art -z-10" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <div className="mx-auto w-full max-w-[1400px] px-4 pb-14 lg:px-10">
                <p className="eyebrow text-white/80">{s.eyebrow}</p>
                <h2 className="display mt-3 text-6xl md:text-9xl">{s.title}</h2>
                <p className="mt-4 max-w-md text-white/85">{s.body}</p>
                {s.ctaLabel && (
                  <Link href={s.ctaHref} tabIndex={i === index ? 0 : -1} className="btn mt-8 border-paper bg-paper text-ink hover:border-accent hover:bg-accent">
                    {s.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-6 right-4 flex items-center gap-3 lg:right-10">
          <div className="flex gap-2" role="tablist" aria-label="Choose slide">
            {slides.map((s, i) => (
              <button key={s.id} type="button" role="tab" aria-selected={i === index} aria-label={`Show slide ${i + 1}`} onClick={() => go(i)}
                className="group flex h-11 items-center px-0.5"><span className={`block h-0.5 transition-all ${i === index ? "w-10 bg-accent" : "w-5 bg-white/50"}`} /></button>
            ))}
          </div>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className="h-10 w-10 border border-white/60 text-paper hover:bg-paper hover:text-ink">←</button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className="h-10 w-10 border border-white/60 text-paper hover:bg-paper hover:text-ink">→</button>
        </div>
      </div>
    </section>
  );
}
