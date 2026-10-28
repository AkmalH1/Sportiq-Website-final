"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyFilters, EMPTY_FILTERS, hasActive, navHeading, navLabel, toQuery, type BrowseProduct, type Filters, type SortKey } from "@/lib/browse";
import { formatLkr } from "@/lib/format";
import { ProductCardView } from "./ProductCardView";

type Comp = { slug: string; name: string; logoUrl: string; count: number };
type Sub = { slug: string; name: string };
type Group = { slug: string; sub: string; name: string; brands: { slug: string; name: string }[] };

/** Text mark used when a competition has no logo: initials of a multi-word name, or the first letters of a single word. */
const mono = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.map((x) => x[0]).join("").slice(0, 3) : (w[0] ?? "").slice(0, 3)).toUpperCase();
};

const chipBase = "eyebrow inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border px-4 py-2 transition-colors";
const chip = (on: boolean) => `${chipBase} ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink"}`;

export function CatalogueBrowser({ sport, sportName, basePath, products, comps, subs, groups, sizeOrder, initial }: {
  sport: string; sportName: string; basePath: string; products: BrowseProduct[]; comps: Comp[]; subs: Sub[]; groups: Group[]; sizeOrder: string[]; initial: Filters;
}) {
  const [f, setF] = useState<Filters>(initial);
  const dialog = useRef<HTMLDialogElement>(null);

  const update = useCallback((patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    // The URL update is a side effect, so it stays out of the state updater.
    try { window.history.replaceState(window.history.state, "", `${basePath}${toQuery(next)}`); } catch { /* URL sync is a nicety only */ }
  }, [f, basePath]);
  const reset = () => update({ ...EMPTY_FILTERS, sort: f.sort });

  const results = useMemo(() => applyFilters(products, f), [products, f]);

  // Facets are built from the real products, and only shown when they would offer a real choice.
  const sizes = useMemo(() => {
    const have = new Set(products.flatMap((p) => p.sizes.filter((s) => s.mode !== "soldout").map((s) => s.size)));
    return sizeOrder.filter((s) => have.has(s)).concat([...have].filter((s) => !sizeOrder.includes(s)));
  }, [products, sizeOrder]);
  const readyN = useMemo(() => products.filter((p) => p.badge === "Ready stock").length, [products]);
  const preN = useMemo(() => products.filter((p) => p.badge === "Pre-order").length, [products]);
  const bounds = useMemo(() => (products.length ? [Math.min(...products.map((p) => p.priceLkr)), Math.max(...products.map((p) => p.priceLkr))] : [0, 0]), [products]);
  const showAvail = readyN > 0 && preN > 0;
  const showPrice = bounds[1] > bounds[0];
  const drawerFilters = (showAvail ? 1 : 0) + (sizes.length > 1 ? 1 : 0) + (showPrice ? 1 : 0);
  const activeDrawer = (f.avail ? 1 : 0) + (f.size ? 1 : 0) + (f.min !== null || f.max !== null ? 1 : 0);

  const compName = comps.find((c) => c.slug === f.comp)?.name;
  const subName = subs.find((s) => s.slug === f.sub)?.name;
  // With only one type in the category there is no type row, so its subgroups are offered directly.
  const rowSub = subs.find((s) => s.slug === (f.sub || (subs.length === 1 ? subs[0].slug : "")));
  const subGroups = rowSub ? groups.filter((g) => g.sub === rowSub.slug) : [];
  const activeGroup = groups.find((g) => g.slug === f.grp);
  const brandCount = (b: string) => products.filter((p) => p.grp === f.grp && p.brand === b && (!f.comp || p.comp === f.comp)).length;
  const chips: { label: string; clear: () => void }[] = [];
  if (compName) chips.push({ label: compName, clear: () => update({ comp: "" }) });
  if (subName) chips.push({ label: subName, clear: () => update({ sub: "", grp: "", brand: "" }) });
  if (activeGroup) chips.push({ label: activeGroup.name, clear: () => update({ grp: "", brand: "" }) });
  if (activeGroup && f.brand) chips.push({ label: activeGroup.brands.find((b) => b.slug === f.brand)?.name ?? f.brand, clear: () => update({ brand: "" }) });
  if (f.avail) chips.push({ label: f.avail === "ready" ? "Ready stock" : "Pre-order", clear: () => update({ avail: "" }) });
  if (f.size) chips.push({ label: `Size ${f.size}`, clear: () => update({ size: "" }) });
  if (f.min !== null || f.max !== null) chips.push({ label: `${f.min !== null ? formatLkr(f.min) : "Any"} to ${f.max !== null ? formatLkr(f.max) : "any"}`, clear: () => update({ min: null, max: null }) });

  return (
    <div>
      {comps.length > 0 && <CompetitionNav sport={sport} label={navLabel(sport)} sportName={sportName} basePath={basePath} comps={comps} total={products.length} active={f.comp} onPick={(slug) => update({ comp: slug })} filters={f} />}

      {subs.length > 1 && (
        <nav aria-label="Product types" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" aria-pressed={!f.sub} onClick={() => update({ sub: "", grp: "", brand: "" })} className={chip(!f.sub)}>All types</button>
          {subs.map((s) => (
            <button key={s.slug} type="button" aria-pressed={f.sub === s.slug} onClick={() => update({ sub: f.sub === s.slug ? "" : s.slug, grp: "", brand: "" })} className={chip(f.sub === s.slug)}>{s.name}</button>
          ))}
        </nav>
      )}

      {subGroups.length > 0 && (
        <nav aria-label={`${rowSub?.name} groups`} className="mt-3 flex items-center gap-2 border-l-2 border-accent pl-3">
          <span className="eyebrow hidden shrink-0 text-stone sm:inline">{rowSub?.name}</span>
          <div className="-mr-4 flex gap-2 overflow-x-auto pr-4 pb-1 lg:mr-0 lg:flex-wrap lg:overflow-visible lg:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" aria-pressed={!f.grp} onClick={() => update({ grp: "", brand: "" })} className={chip(!f.grp)}>All {rowSub?.name}</button>
            {subGroups.map((g) => (
              <button key={g.slug} type="button" aria-pressed={f.grp === g.slug} onClick={() => update({ grp: f.grp === g.slug ? "" : g.slug, brand: "" })} className={chip(f.grp === g.slug)}>{g.name}</button>
            ))}
          </div>
        </nav>
      )}

      {activeGroup && activeGroup.brands.length > 0 && (
        <nav aria-label={`Brands in ${activeGroup.name}`} className="mt-3 ml-4 flex items-center gap-2 border-l-2 border-line pl-3">
          <span className="eyebrow hidden shrink-0 text-stone sm:inline">Brands</span>
          <div className="-mr-4 flex gap-2 overflow-x-auto pr-4 pb-1 lg:mr-0 lg:flex-wrap lg:overflow-visible lg:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" aria-pressed={!f.brand} onClick={() => update({ brand: "" })} className={chip(!f.brand)}>All brands</button>
            {activeGroup.brands.map((b) => {
              const n = brandCount(b.slug);
              return (
                <button key={b.slug} type="button" aria-pressed={f.brand === b.slug} disabled={n === 0 && f.brand !== b.slug} onClick={() => update({ brand: f.brand === b.slug ? "" : b.slug })}
                  className={`${chip(f.brand === b.slug)} disabled:cursor-not-allowed disabled:text-stone/60 disabled:hover:border-line`}>
                  {b.name}{n > 0 && <span className="ml-2 text-[10px] opacity-60">{n}</span>}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
        <p className="text-sm text-stone" role="status" aria-live="polite">
          <strong className="text-ink">{results.length}</strong> product{results.length === 1 ? "" : "s"}
          {hasActive(f) && <> of {products.length}</>}
        </p>
        <div className="flex items-center gap-2">
          {drawerFilters > 0 && (
            <button type="button" onClick={() => dialog.current?.showModal()} className="eyebrow inline-flex min-h-11 items-center gap-2 border border-ink px-4 py-2 hover:bg-ink hover:text-paper">
              Filters{activeDrawer > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center bg-accent px-1 text-[10px] text-ink">{activeDrawer}</span>}
            </button>
          )}
          <label className="sr-only" htmlFor="sort-select">Sort products</label>
          <select id="sort-select" value={f.sort} onChange={(e) => update({ sort: e.target.value as SortKey })} className="field !min-h-11 !w-auto !py-2 text-sm">
            <option value="newest">Newest</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="inline-flex min-h-9 items-center gap-2 bg-mist px-3 text-xs hover:bg-line">
              {c.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" onClick={reset} className="min-h-9 px-2 text-xs underline text-stone">Clear all</button>
        </div>
      )}

      <div className="mt-8">
        {results.length === 0 ? (
          <div className="border border-dashed border-line bg-mist p-10 text-center sm:p-12">
            <p className="font-semibold">No products match these filters</p>
            <p className="mt-1 text-sm text-stone">Try removing a filter, or start again from all {sportName.toLowerCase()} products.</p>
            <button type="button" onClick={reset} className="btn btn-primary mt-6">Show all {sportName}</button>
          </div>
        ) : (
          <ul className="pgrid pgrid-fade grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4">
            {results.map((p, i) => <li key={p.slug}><ProductCardView product={p} priority={i < 4} /></li>)}
          </ul>
        )}
      </div>

      <dialog ref={dialog} aria-labelledby="filters-h" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-0 mt-auto h-auto max-h-[88dvh] w-full max-w-none bg-paper p-0 text-ink backdrop:bg-black/50 sm:ml-auto sm:mt-0 sm:h-full sm:max-h-none sm:max-w-sm">
        <div className="flex h-full max-h-[88dvh] flex-col sm:max-h-none">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="filters-h" className="display text-3xl">Filters</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close filters" className="inline-flex h-11 w-11 items-center justify-center text-2xl leading-none">×</button>
          </div>
          <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
            {showAvail && (
              <fieldset>
                <legend className="eyebrow mb-3 text-stone">Availability</legend>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={!f.avail} onClick={() => update({ avail: "" })} className={chip(!f.avail)}>All</button>
                  <button type="button" aria-pressed={f.avail === "ready"} onClick={() => update({ avail: f.avail === "ready" ? "" : "ready" })} className={chip(f.avail === "ready")}>Ready stock ({readyN})</button>
                  <button type="button" aria-pressed={f.avail === "preorder"} onClick={() => update({ avail: f.avail === "preorder" ? "" : "preorder" })} className={chip(f.avail === "preorder")}>Pre-order ({preN})</button>
                </div>
              </fieldset>
            )}
            {sizes.length > 1 && (
              <fieldset>
                <legend className="eyebrow mb-3 text-stone">Size</legend>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button key={s} type="button" aria-pressed={f.size === s} onClick={() => update({ size: f.size === s ? "" : s })} className={`${chip(f.size === s)} min-w-12 justify-center`}>{s}</button>
                  ))}
                </div>
              </fieldset>
            )}
            {showPrice && (
              <fieldset>
                <legend className="eyebrow mb-3 text-stone">Price (LKR)</legend>
                <div className="flex items-center gap-3">
                  <input aria-label="Minimum price" inputMode="numeric" type="number" min={0} placeholder={String(bounds[0])} value={f.min ?? ""} onChange={(e) => update({ min: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) })} className="field" />
                  <span aria-hidden="true">to</span>
                  <input aria-label="Maximum price" inputMode="numeric" type="number" min={0} placeholder={String(bounds[1])} value={f.max ?? ""} onChange={(e) => update({ max: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) })} className="field" />
                </div>
              </fieldset>
            )}
          </div>
          <div className="flex gap-3 border-t border-line px-5 py-4">
            <button type="button" onClick={reset} className="btn btn-ghost !px-4 flex-1">Clear</button>
            <button type="button" onClick={() => dialog.current?.close()} className="btn btn-primary !px-4 flex-[2]">View {results.length} product{results.length === 1 ? "" : "s"}</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CompetitionNav({ sport, label, sportName, basePath, comps, total, active, onPick, filters }: {
  sport: string; label: string; sportName: string; basePath: string; comps: Comp[]; total: number; active: string; onPick: (slug: string) => void; filters: Filters;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState({ n: 1, i: 0 });
  const hold = useRef(false); // true while hovered, focused, touched, or once the visitor has chosen something
  const [bold, light] = navHeading(sport);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) return setPage({ n: 1, i: 0 });
    const n = Math.ceil(el.scrollWidth / el.clientWidth);
    setPage({ n, i: Math.min(n - 1, Math.round((el.scrollLeft / max) * (n - 1))) });
  }, []);
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, comps.length]);

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: page.n > 1 ? (i * max) / (page.n - 1) : 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [page.n]);

  // Gentle auto-advance, looping. It pauses on hover, focus or touch, stops for good once the visitor picks something,
  // and never runs with reduced motion or in a background tab.
  useEffect(() => {
    if (page.n <= 1 || reducedMotion()) return;
    const t = window.setInterval(() => {
      if (hold.current || document.hidden) return;
      goTo(page.i + 1 >= page.n ? 0 : page.i + 1);
    }, 3800);
    return () => window.clearInterval(t);
  }, [page.n, page.i, goTo]);

  // Keep a chosen item in view (including when it came from a shared link).
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const box = scroller.current;
    if (!el || !box || active === "") return;
    box.scrollTo({ left: Math.max(0, el.offsetLeft - (box.clientWidth - el.clientWidth) / 2), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const href = (slug: string) => `${basePath}${toQuery({ ...filters, comp: slug })}`;
  const item = (slug: string, name: string, logoUrl: string, count: number, on: boolean) => (
    <li key={slug || "all"} className="shrink-0 snap-start">
      <a
        href={href(slug)}
        aria-current={on ? "true" : undefined}
        aria-label={`${slug === "" ? `All ${sportName}` : name}, ${count} product${count === 1 ? "" : "s"}`}
        onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); hold.current = true; onPick(slug); }}
        className={`group/logo relative flex h-32 w-36 flex-col items-center justify-center gap-2 px-3 text-center transition-transform duration-200 hover:scale-105 sm:w-44 ${on ? "" : "opacity-90 hover:opacity-100"}`}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" loading="lazy" decoding="async" width={160} height={96} className="h-20 w-32 object-contain sm:h-24 sm:w-40" />
        ) : (
          <>
            <span className="display text-4xl leading-none sm:text-5xl" aria-hidden="true">{slug === "" ? "All" : mono(name)}</span>
            <span className="line-clamp-2 w-full break-words text-[11px] font-semibold uppercase leading-tight tracking-wide text-stone" aria-hidden="true">{slug === "" ? sportName : name}</span>
          </>
        )}
        <span aria-hidden="true" className={`absolute bottom-0 left-1/2 h-[3px] -translate-x-1/2 bg-accent transition-all duration-300 ${on ? "w-12" : "w-0 group-hover/logo:w-6"}`} />
      </a>
    </li>
  );

  return (
    <section aria-label={label} className="py-2" onPointerEnter={() => { hold.current = true; }} onPointerLeave={() => { hold.current = false; }} onFocusCapture={() => { hold.current = true; }} onBlurCapture={() => { hold.current = false; }} onTouchStart={() => { hold.current = true; }}>
      <div className="text-center">
        <h2 className="text-3xl uppercase tracking-tight sm:text-4xl"><span className="font-extrabold">{bold}</span> <span className="font-light">{light}</span></h2>
        <p className="mt-2 text-sm text-stone sm:text-base">Find your team&apos;s style in one place.</p>
      </div>
      <ul
        ref={scroller}
        onScroll={measure}
        className={`mt-6 flex snap-x snap-proximity gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6 ${page.n <= 1 ? "justify-center" : ""}`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {item("", sportName, "", total, active === "")}
        {comps.map((c) => item(c.slug, c.name, c.logoUrl, c.count, active === c.slug))}
      </ul>
      {page.n > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2" role="group" aria-label={`${label} pages`}>
          {Array.from({ length: page.n }, (_, i) => (
            <button key={i} type="button" onClick={() => { hold.current = true; goTo(i); }} aria-label={`Show ${label.toLowerCase()} page ${i + 1} of ${page.n}`} aria-current={i === page.i ? "true" : undefined}
              className="group/dot flex h-6 items-center px-0.5">
              <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === page.i ? "w-10 bg-accent" : "w-8 bg-line group-hover/dot:bg-stone"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
