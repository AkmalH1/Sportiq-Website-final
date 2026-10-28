"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SizeState } from "@/lib/types";
import { formatLkr } from "@/lib/format";
import { useCart } from "./CartProvider";
import { SizeGuide } from "./SizeGuide";
import type { SizeChart } from "@/lib/sizechart";
import { ImagePicker } from "./ImagePicker";
import { EMPTY_OPTIONS, addonPerUnit, isDefault, type ItemOptions, type OptionPrices } from "@/lib/options";

export function ProductPurchase({
  slug, name, price, sizes, preorderEnabled, eta, customizable, prices, chart, showVersion = false, versions = ["fan", "player"],
}: { slug: string; name: string; price: number; sizes: SizeState[]; preorderEnabled: boolean; eta: string; customizable: boolean; prices: OptionPrices; chart: SizeChart | null; showVersion?: boolean; versions?: ("fan" | "player")[] }) {
  const [sku, setSku] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const mainBtn = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const el = mainBtn.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [opts, setOpts] = useState<ItemOptions>({ ...EMPTY_OPTIONS, version: versions[0] ?? "fan" });
  const [wantCustom, setWantCustom] = useState(false);
  const { add } = useCart();
  const chosen = sizes.find((s) => s.sku === sku) ?? null;

  const split = chosen && chosen.mode === "ready" && qty > chosen.stock ? { ready: chosen.stock, pre: qty - chosen.stock } : null;
  const preQty = chosen ? (chosen.mode === "preorder" ? qty : split ? split.pre : 0) : 0;
  // Football jerseys always offer Fan / Player Version. Sleeves, names and patches only when the product is customisable.
  const effective: ItemOptions = customizable
    ? (wantCustom ? opts : { ...opts, custom: "", customImage: "" })
    : { ...EMPTY_OPTIONS, version: opts.version };
  const addon = customizable || showVersion ? addonPerUnit(effective, prices) : 0;
  const unit = price + addon;
  const preTotal = preQty * unit;

  const label = (s: SizeState) => (s.mode === "ready" ? `${s.stock} in stock` : s.mode === "preorder" ? "Pre-order" : "Sold out");

  function addToCart() {
    if (!chosen || chosen.mode === "soldout") return;
    const final = effective;
    add({ sku: chosen.sku, qty, name, size: chosen.size, slug, options: (customizable || showVersion) && !isDefault(final) ? final : undefined });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div>
      <fieldset>
        <legend className="flex w-full items-baseline justify-between">
          <span className="eyebrow">Select size</span>
          <span className="flex items-center gap-4 text-xs text-stone">{chart && <SizeGuide chart={chart} title={name} />}{preorderEnabled ? "Pre-order open for every size" : "Ready stock only"}</span>
        </legend>
        <div className={`mt-4 grid gap-2 ${sizes.length === 1 ? "grid-cols-1 sm:max-w-xs" : "grid-cols-3 sm:grid-cols-6"}`}>
          {sizes.map((s) => {
            const off = s.mode === "soldout";
            return (
              <label key={s.sku} className={off ? "opacity-40" : ""}>
                <input type="radio" name="size" value={s.sku} disabled={off} checked={sku === s.sku} onChange={() => { setSku(s.sku); setQty(1); }} className="peer sr-only" />
                <span className="flex cursor-pointer flex-col items-center border border-line px-1 py-3 text-center peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:line-through">
                  <span className="text-sm font-semibold">{s.size}</span>
                  <span className={`mt-1 text-[10px] uppercase tracking-wider ${s.mode === "preorder" ? "text-accent-dark peer-checked:text-accent" : "opacity-70"}`}>{label(s)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {showVersion && (
        <fieldset className="mt-8">
          <legend className="eyebrow">Choose your version</legend>
          <div className={`mt-3 grid items-stretch gap-3 ${versions.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {([
              ["fan", "Fan Version", "Included in the price", "Relaxed, regular fit for everyday wear and the stands. Comfortable and easy to wear all day."],
              ["player", "Player Version", `+ ${formatLkr(prices.playerVersion)}`, "Slim, athletic, performance-style cut with heat-pressed detailing, like the shirt on the pitch. Fits closer, so size up if you prefer it looser."],
            ] as const).filter(([id]) => versions.includes(id)).map(([id, t, p, d]) => (
              <label key={id}>
                <input type="radio" name="version" checked={opts.version === id} onChange={() => setOpts((o) => ({ ...o, version: id }))} className="peer sr-only" />
                <span className="flex h-full cursor-pointer flex-col items-stretch border border-line p-4 text-left text-sm peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  <span className="flex items-baseline justify-between gap-3"><span className="font-semibold">{t}</span><span className="whitespace-nowrap text-xs font-semibold text-accent-dark">{p}</span></span>
                  <span className="mt-2 block text-left text-xs leading-relaxed text-stone">{d}</span>
                </span>
              </label>
            ))}
          </div>
          {!customizable && addon > 0 && <p className="mt-3 text-sm">Player Version: <strong>{formatLkr(addon)}</strong> extra per shirt. Each shirt will be {formatLkr(unit)}.</p>}
        </fieldset>
      )}

      {customizable && (
        <div className="mt-8 space-y-6 border border-line p-5">
          <p className="eyebrow">Make it yours</p>
          <fieldset>
            <legend className="text-sm font-semibold">Sleeves</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([["short", "Short sleeves", "Included"], ["long", "Long sleeves", `+ ${formatLkr(prices.longSleeve)}`]] as const).map(([id, t, p]) => (
                <label key={id}>
                  <input type="radio" name="sleeve" checked={opts.sleeve === id} onChange={() => setOpts((o) => ({ ...o, sleeve: id }))} className="peer sr-only" />
                  <span className="block cursor-pointer border border-line p-3 text-sm peer-checked:border-ink peer-checked:bg-mist peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    <span className="font-semibold">{t}</span><span className="block text-xs text-stone">{p}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={wantCustom} onChange={(e) => setWantCustom(e.target.checked)} />
              Customisation (name and number) <span className="font-normal text-stone">+ {formatLkr(prices.customisation)}</span>
            </label>
            {wantCustom && (
              <div className="mt-3 space-y-3">
                <input value={opts.custom} maxLength={80} onChange={(e) => setOpts((o) => ({ ...o, custom: e.target.value }))} placeholder="Write it here, e.g. MESSI 10" className="field" aria-label="Customisation wording" />
                <ImagePicker label="Or attach an image" value={opts.customImage} onChange={(u) => setOpts((o) => ({ ...o, customImage: u }))} />
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold">Patches <span className="font-normal text-stone">1st {formatLkr(prices.patches[0])} · 2nd {formatLkr(prices.patches[1])} · 3rd {formatLkr(prices.patches[2])}</span></p>
            <div className="mt-3 space-y-3">
              {opts.patches.map((p, i) => (
                <div key={i} className="space-y-2 border-l-2 border-accent pl-3">
                  <div className="flex gap-2">
                    <input value={p.text} maxLength={80} onChange={(e) => setOpts((o) => ({ ...o, patches: o.patches.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} placeholder={`Patch ${i + 1}: which patch? (e.g. Champions League)`} className="field" aria-label={`Patch ${i + 1} description`} />
                    <button type="button" className="text-xs underline text-stone" onClick={() => setOpts((o) => ({ ...o, patches: o.patches.filter((_, j) => j !== i) }))}>Remove</button>
                  </div>
                  <ImagePicker label="Or attach an image" value={p.image} onChange={(u) => setOpts((o) => ({ ...o, patches: o.patches.map((x, j) => (j === i ? { ...x, image: u } : x)) }))} />
                </div>
              ))}
              {opts.patches.length < 3 && (
                <button type="button" className="btn btn-ghost !px-4 !py-2 text-xs" onClick={() => setOpts((o) => ({ ...o, patches: [...o.patches, { text: "", image: "" }] }))}>
                  Add patch {opts.patches.length + 1}
                </button>
              )}
            </div>
          </div>
          {addon > 0 && <p className="text-sm">Extras (version, sleeves, name, patches): <strong>{formatLkr(addon)}</strong> per shirt. Each shirt will be {formatLkr(unit)}.</p>}
          <p className="text-xs text-stone">Customised shirts cannot be exchanged. We confirm the artwork with you on WhatsApp if anything is unclear.</p>
        </div>
      )}

      <div className="mt-6 min-h-16 border-l-2 border-accent bg-mist px-4 py-3 text-sm" aria-live="polite">
        {!chosen && <p className="text-stone">Choose a size to see availability.</p>}
        {chosen?.mode === "ready" && !split && <p><strong>Ready stock.</strong> {chosen.stock} available now, ships once payment is confirmed.</p>}
        {chosen?.mode === "ready" && split && (
          <p><strong>{split.ready} ready stock + {split.pre} pre-order.</strong> Only {chosen.stock} in stock; the rest is pre-ordered{preorderEnabled ? "" : " (not available)"}.</p>
        )}
        {chosen?.mode === "preorder" && <p><strong>Pre-order.</strong> {eta ? `${eta}.` : "Estimated arrival shown at checkout."} Full payment is recommended. Or pay half now and the rest in cash on delivery.</p>}
        {chosen?.mode === "soldout" && <p>This size is sold out.</p>}
      </div>

      {preQty > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-stone">Pay in full</dt><dd className="text-right font-semibold">{formatLkr(preTotal)}</dd>
          <dt className="text-stone">Or half of the pre-order items now</dt><dd className="text-right font-semibold">{formatLkr(Math.ceil(preTotal / 2))}</dd>
        </dl>
      )}

      <div ref={mainBtn} className="mt-6 flex items-center gap-3">
        <div className="flex items-center border border-line" role="group" aria-label="Quantity">
          <button type="button" className="h-12 w-11 text-lg" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
          <button type="button" className="h-12 w-11 text-lg" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(10, q + 1))}>+</button>
        </div>
        <button type="button" onClick={addToCart} disabled={!chosen || chosen.mode === "soldout"} className="btn btn-primary h-12 flex-1">
          {chosen?.mode === "preorder" ? "Pre-order" : "Add to cart"}{addon > 0 ? ` · ${formatLkr(unit * qty)}` : ""}
        </button>
      </div>
      {offscreen && (
        <div className="fixed inset-x-3 bottom-24 z-40 md:hidden">
          <button type="button" className="btn btn-primary h-12 w-full shadow-[0_14px_30px_rgba(0,0,0,0.4)]" disabled={chosen?.mode === "soldout"}
            onClick={() => (chosen ? addToCart() : mainBtn.current?.scrollIntoView({ behavior: "smooth", block: "center" }))}>
            {!chosen ? "Choose a size" : chosen.mode === "preorder" ? "Pre-order" : "Add to cart"}
          </button>
        </div>
      )}
      {added && (
        <p className="mt-3 text-sm" role="status">
          Added to cart. <Link href="/cart" className="font-semibold underline">View cart</Link>
        </p>
      )}
    </div>
  );
}
