"use client";

import { useRef } from "react";

/** Gives a card a soft 3D tilt and light glare that follow the mouse. Works with a finger too, and does nothing with reduced motion. */
export function Tilt({ children, className = "", max = 9 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    // Touch scrolling must never be hijacked: tilt follows a mouse or pen only. Fingers get a press-depth effect from CSS instead.
    if (!el || e.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.classList.add("is-tilting");
      el.style.transform = `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max * 1.2).toFixed(2)}deg) translateZ(0)`;
      el.style.setProperty("--gx", `${(px * 100).toFixed(0)}%`);
      el.style.setProperty("--gy", `${(py * 100).toFixed(0)}%`);
    });
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.classList.remove("is-tilting");
    el.style.transform = "";
  };

  return (
    <div ref={ref} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave} onPointerUp={leave} style={{ touchAction: "pan-y" }}>
      {children}
      <span className="tilt-glare" aria-hidden="true" />
    </div>
  );
}
