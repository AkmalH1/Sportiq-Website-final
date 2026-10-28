"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  shop: <path d="M5 7h14l-1 13H6zM9 7a3 3 0 0 1 6 0" />,
  caps: <path d="M4 15a8 8 0 0 1 16 0M2 15h20l-3 3H8z" />,
  track: <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />,
  cart: <path d="M3 4h3l2 12h11l2-8H7M10 20h.01M18 20h.01" />,
};

const TABS = [
  ["Home", "/", "home"],
  ["Shop", "/shop", "shop"],
  ["Caps", "/caps", "caps"],
  ["Track", "/track-order", "track"],
  ["Cart", "/cart", "cart"],
] as const;

/** App-style bottom navigation for phones. */
export function MobileTabBar() {
  const path = usePathname();
  const { count } = useCart();
  if (path.startsWith("/admin")) return null;
  return (
    <nav aria-label="Quick navigation" className="tabbar fixed inset-x-3 bottom-3 z-50 md:hidden">
      <ul className="flex items-stretch justify-between border border-white/15 bg-ink/90 px-1 py-1 text-paper shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {TABS.map(([label, href, icon]) => {
          const on = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={on ? "page" : undefined} className={`tab relative flex flex-col items-center gap-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition ${on ? "text-accent" : "text-white/70"}`}>
                <span className={`relative transition-transform duration-300 ${on ? "-translate-y-1 scale-110" : ""}`}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
                  {href === "/cart" && count > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center bg-accent px-1 text-[9px] text-ink">{count}</span>}
                </span>
                {label}
                {on && <span className="absolute -bottom-0.5 h-0.5 w-8 bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
