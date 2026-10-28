"use client";

import { useEffect, useRef } from "react";

/**
 * A swipeable 3D coverflow for phones: the card in the middle faces you, the ones either side swing away.
 * Pure scroll-snap, so it also works with a keyboard and without JavaScript effects.
 */
export function Coverflow({ children, label }: { children: React.ReactNode[]; label: string }) {
  const box = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const c = el.scrollLeft + el.clientWidth / 2;
      for (const it of items) {
        const d = (it.offsetLeft + it.offsetWidth / 2 - c) / it.offsetWidth; // 0 = centred
        const a = Math.min(Math.abs(d), 1.6);
        const inner = it.firstElementChild as HTMLElement | null;
        if (!inner) continue;
        if (reduced) { inner.style.opacity = String(1 - a * 0.25); continue; }
        inner.style.transform = `translateZ(${(-a * 90).toFixed(0)}px) rotateY(${(-d * 42).toFixed(1)}deg) scale(${(1 - a * 0.1).toFixed(3)})`;
        inner.style.opacity = String(Math.max(0.35, 1 - a * 0.35));
      }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    el.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      el.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <ul
      ref={box}
      aria-label={label}
      className="coverflow -mx-4 flex snap-x snap-mandatory gap-0 overflow-x-auto px-[15vw] py-10"
      style={{ perspective: "900px", scrollbarWidth: "none" }}
    >
      {children.map((c, i) => (
        <li key={i} className="w-[70vw] shrink-0 snap-center px-2" style={{ transformStyle: "preserve-3d" }}>
          <div style={{ transformStyle: "preserve-3d", transition: "opacity .2s" }}>{c}</div>
        </li>
      ))}
    </ul>
  );
}
