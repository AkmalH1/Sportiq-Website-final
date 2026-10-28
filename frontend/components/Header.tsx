"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Sport } from "@/lib/types";
import { Wordmark } from "./Wordmark";
import { useCart } from "./CartProvider";

export function Header({ sports }: { sports: Sport[] }) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const wrapRef = useRef<HTMLElement>(null);
  const { count } = useCart();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMegaOpen(false);
        setMobileOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const close = () => {
    setMegaOpen(false);
    setMobileOpen(false);
  };
  const navLink = "eyebrow whitespace-nowrap px-2.5 py-2 hover:text-accent-dark";

  return (
    <header
      ref={wrapRef}
      className={`sticky top-0 z-50 bg-paper/95 backdrop-blur transition-shadow ${scrolled ? "shadow-[0_1px_0_var(--color-line)]" : ""}`}
    >
      <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-4 lg:px-10">
        <div className="flex items-center">
          <button
            type="button"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 8h18M3 16h18" />}
            </svg>
          </button>
          <nav className="hidden items-center lg:flex" aria-label="Primary">
            <button type="button" className={navLink} aria-expanded={megaOpen} aria-controls="mega-menu" onClick={() => setMegaOpen((v) => !v)}>
              Shop by sport
            </button>
            <Link href="/caps" className={navLink}>Caps</Link>
            <Link href="/collections/latest-drops" className={navLink}>New in</Link>
            <Link href="/collections/retro-archive" className={`${navLink} hidden xl:block`}>Retro</Link>
            <Link href="/help/pre-orders" className={navLink}>Pre-orders</Link>
            <Link href="/gift-cards" className={navLink}>Gift cards</Link>
            <Link href="/about" className={navLink}>About</Link>
          </nav>
        </div>

        <Link href="/" onClick={close} className="inline-flex min-h-11 items-center text-[2rem] leading-none" aria-label="SPORTIQ home">
          <Wordmark />
        </Link>

        <div className="flex items-center justify-end">
          <form action="/search" role="search" className="mr-2 hidden xl:block">
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" name="q" type="search" placeholder="Search" className="w-40 border-b border-line bg-transparent px-1 py-1.5 text-sm placeholder:text-stone focus:border-ink focus:outline-none" />
          </form>
          <Link href="/search" className="eyebrow inline-flex min-h-11 items-center px-3 py-2 hover:text-accent-dark xl:hidden">Search</Link>
          <Link href="/track-order" className="eyebrow hidden min-h-11 items-center px-3 py-2 hover:text-accent-dark md:inline-flex">Track</Link>
          <Link href="/cart" className="eyebrow inline-flex min-h-11 items-center px-3 py-2 hover:text-accent-dark" aria-label={`Cart, ${count} items`}>
            Cart{count > 0 && <span className="ml-1.5 inline-flex min-w-5 items-center justify-center bg-accent px-1.5 text-[10px] text-ink">{count}</span>}
          </Link>
        </div>
      </div>

      {megaOpen && (
        <div id="mega-menu" className="absolute inset-x-0 top-full hidden border-y border-line bg-paper lg:block">
          <div className="mx-auto grid max-w-[1400px] grid-cols-4 gap-x-10 gap-y-8 px-10 py-10">
            {sports.map((s) => (
              <div key={s.slug}>
                <Link href={`/sports/${s.slug}`} onClick={close} className="display text-3xl hover:text-accent-dark">{s.name}</Link>
                <ul className="mt-3 space-y-1.5">
                  {s.subcategories.map((sub) => (
                    <li key={sub}>
                      <Link href={`/sports/${s.slug}?type=${encodeURIComponent(sub)}`} onClick={close} className="text-sm text-stone hover:text-ink">{sub}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex items-end">
              <Link href="/shop" onClick={close} className="btn btn-ghost">Shop all</Link>
            </div>
          </div>
        </div>
      )}

      {mobileOpen && (
        <nav id="mobile-menu" aria-label="Mobile" className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-line bg-paper px-4 py-6 lg:hidden">
          <ul className="space-y-1">
            {sports.map((s) => (
              <li key={s.slug}>
                <Link href={`/sports/${s.slug}`} onClick={close} className="display block border-b border-line py-3 text-3xl">{s.name}</Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 grid grid-cols-2 gap-3 eyebrow">
            {[
              ["Caps", "/caps"],
              ["New in", "/collections/latest-drops"],
              ["Retro", "/collections/retro-archive"],
              ["Pre-orders", "/help/pre-orders"],
              ["Gift cards", "/gift-cards"],
              ["About us", "/about"],
              ["Track order", "/track-order"],
              ["Returns", "/returns"],
              ["Shipping", "/shipping"],
            ].map(([label, href]) => (
              <li key={href}><Link href={href} onClick={close} className="block py-2">{label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
