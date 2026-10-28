"use client";

import { useState } from "react";
import { Tilt } from "./Tilt";

/** Main photo plus thumbnails. Tapping a thumbnail (or using the arrow buttons) swaps the main photo with a soft fade. */
export function ProductGallery({ name, images, demo = false }: { name: string; images: string[]; demo?: boolean }) {
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(true);
  const count = images.length;
  const go = (n: number) => {
    if (n === i || n < 0 || n >= count) return;
    setLoaded(false);
    setI(n);
  };
  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <Tilt max={5} className="relative aspect-[4/5] w-full overflow-hidden bg-mist">
        {count > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={images[i]}
            src={images[i]}
            alt={`${name} photo ${i + 1} of ${count}`}
            fetchPriority="high"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg viewBox="0 0 100 120" className="h-1/2 text-line" fill="currentColor" aria-hidden="true">
              <path d="M32 10l-24 14 8 22 12-4v68h48V42l12 4 8-22-24-14c-3 8-10 12-18 12s-15-4-18-12z" />
            </svg>
          </div>
        )}
        {demo && <span className="eyebrow absolute left-0 top-4 bg-ink px-3 py-1.5 text-paper">Demo product</span>}
        {count > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go((i - 1 + count) % count)} className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-lg shadow transition hover:bg-paper">‹</button>
            <button type="button" aria-label="Next photo" onClick={() => go((i + 1) % count)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-lg shadow transition hover:bg-paper">›</button>
            <span className="absolute bottom-3 right-3 bg-ink/70 px-2 py-1 text-[11px] text-paper">{i + 1} / {count}</span>
          </>
        )}
      </Tilt>
      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Product photos">
          {images.map((u, n) => (
            <li key={u} className="shrink-0">
              <button
                type="button"
                onClick={() => go(n)}
                aria-label={`Show photo ${n + 1}`}
                aria-current={n === i}
                className={`block h-16 w-14 overflow-hidden border-2 transition sm:h-20 sm:w-16 ${n === i ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
