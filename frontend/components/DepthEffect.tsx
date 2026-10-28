"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Scroll-linked 3D: anything marked data-depth leans back as it enters and leaves the screen and sits flat in the middle,
 * like cards on a conveyor belt. One scroll listener for the whole page. Disabled with reduced motion.
 */
export function DepthEffect() {
  const path = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"));
    if (els.length === 0) return;
    const visible = new Set<HTMLElement>();
    let raf = 0;
    const amp = () => (window.innerWidth < 768 ? 1 : 0.55);

    const paint = () => {
      raf = 0;
      const vh = window.innerHeight;
      const a = amp();
      for (const el of visible) {
        const r = el.getBoundingClientRect();
        const t = Math.max(-1.2, Math.min(1.2, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
        const abs = Math.abs(t);
        const side = Number(el.dataset.side || 0); // -1 left column, 1 right column: lean slightly towards the centre
        el.style.transform = `perspective(900px) rotateX(${(-t * 12 * a).toFixed(2)}deg) rotateY(${(side * abs * 5 * a).toFixed(2)}deg) translateZ(${(-abs * 46 * a).toFixed(1)}px) scale(${(1 - abs * 0.035 * a).toFixed(3)})`;
      }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) visible.add(el);
          else { visible.delete(el); el.style.transform = ""; }
        }
        queue();
      },
      { rootMargin: "20% 0px" },
    );
    els.forEach((el) => io.observe(el));
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
      els.forEach((el) => (el.style.transform = ""));
    };
  }, [path]);
  return null;
}
