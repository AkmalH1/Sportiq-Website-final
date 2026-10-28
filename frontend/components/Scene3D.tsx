"use client";

import { useEffect, useRef } from "react";

const JERSEY = "M32 10l-24 14 8 22 12-4v68h48V42l12 4 8-22-24-14c-3 8-10 12-18 12s-15-4-18-12z";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * A floating stack of 3D jersey panels. Pure CSS 3D, no extra libraries.
 * Desktop: follows the mouse and the scroll. Phones: drag it with a finger to spin it, it keeps drifting when you let go.
 */
export function Scene3D({ className = "", interactive = false }: { className?: string; interactive?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const host = root.current;
    if (!el || !host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let mx = 0, my = 0; // mouse offset, -0.5..0.5
    let spin = -22; // current yaw in degrees
    let tilt = 0; // current pitch from dragging
    let vel = 0; // spin velocity after a flick
    let dragging = false;
    let lastX = 0, lastY = 0;
    let visible = true;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(48, now - last) / 16.67;
      last = now;
      if (!dragging) {
        spin += vel * dt;
        vel *= 0.94;
        if (interactive && Math.abs(vel) < 0.05) spin += 0.22 * dt; // slow idle drift on phones
        tilt *= 0.96;
      }
      const sy = Math.min(window.scrollY, 900) / 900;
      const yaw = interactive ? spin : -22 + mx * 16 + sy * 30;
      const pitch = interactive ? tilt + 8 : -my * 10 + sy * 18;
      el.style.transform = `rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
      if (visible && (interactive || sy < 1)) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const onMove = (e: PointerEvent) => {
      if (interactive || e.pointerType !== "mouse") return;
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      kick();
    };
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0; host.setPointerCapture?.(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      spin += dx * 0.6;
      vel = dx * 0.25;
      tilt = clamp(tilt + dy * 0.25, -22, 22);
    };
    const up = () => { dragging = false; };

    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); });
    io.observe(host);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("scroll", kick, { passive: true });
    if (interactive) {
      host.addEventListener("pointerdown", down);
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerup", up);
      host.addEventListener("pointercancel", up);
    }
    kick();
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", kick);
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [interactive]);

  return (
    <div
      ref={root}
      className={`scene ${interactive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${className}`}
      style={interactive ? { touchAction: "pan-y" } : undefined}
      aria-hidden="true"
    >
      <div ref={stage} className="scene-stage relative h-full w-full" style={{ transform: "rotateY(-22deg)" }}>
        {/* floor ring and shadow */}
        <div className="scene-plane" style={{ transform: "translateZ(-200px)" }}>
          <div className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        </div>
        <div className="scene-plane" style={{ transform: "rotateX(90deg) translateZ(-150px)" }}>
          <div className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)" }} />
        </div>
        {/* floating cubes for depth */}
        <Cube x="12%" y="18%" z={160} s={22} delay="0s" />
        <Cube x="84%" y="30%" z={-40} s={16} delay="-2s" />
        <Cube x="76%" y="82%" z={200} s={26} delay="-4s" />
        <Cube x="18%" y="76%" z={-120} s={14} delay="-1s" />
        <Panel z={-120} fill="none" stroke="rgba(255,255,255,0.28)" cls="bob-slow" label="" />
        <Panel z={0} fill="#1c1c1c" stroke="rgba(255,255,255,0.55)" cls="bob" label="10" />
        <Panel z={130} fill="rgba(244,114,10,0.92)" stroke="#fff" cls="bob-slow" label="Q" big />
      </div>
    </div>
  );
}

function Cube({ x, y, z, s, delay }: { x: string; y: string; z: number; s: number; delay: string }) {
  const h = s / 2;
  return (
    <div className="scene-plane" style={{ transform: `translateZ(${z}px)` }}>
      <div className="cube absolute" style={{ left: x, top: y, width: s, height: s, ["--h" as string]: `${h}px`, animationDelay: delay, animationDuration: "14s" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ fontSize: 0, borderWidth: 1 }} />)}
      </div>
    </div>
  );
}

function Panel({ z, fill, stroke, cls, label, big }: { z: number; fill: string; stroke: string; cls: string; label: string; big?: boolean }) {
  return (
    <div className={`scene-plane ${cls}`} style={{ transform: `translateZ(${z}px)` }}>
      <svg viewBox="0 0 100 120" className="absolute left-1/2 top-1/2 h-[78%] -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl" fill={fill} stroke={stroke} strokeWidth={1.2}>
        <path d={JERSEY} />
        {label && (
          <text x="50" y="78" textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={big ? 34 : 28} fill={big ? "#111" : "rgba(255,255,255,0.7)"} stroke="none">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
