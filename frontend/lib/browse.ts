/** Pure catalogue-browsing logic shared by the server page (initial state) and the client browser. No server-only imports. */

export type BrowseSize = { size: string; mode: "ready" | "preorder" | "soldout" };
export type BrowseProduct = {
  slug: string; name: string; imageUrl: string; sportSlug: string; isDemo: boolean; type: string; version: string;
  priceLkr: number; badge: "Ready stock" | "Pre-order" | "Sold out"; sizes: BrowseSize[]; sub: string; comp: string; grp: string; brand: string;
};
export type SortKey = "newest" | "low" | "high";
export type Filters = { comp: string; sub: string; grp: string; brand: string; avail: "" | "ready" | "preorder"; size: string; min: number | null; max: number | null; sort: SortKey };
export const EMPTY_FILTERS: Filters = { comp: "", sub: "", grp: "", brand: "", avail: "", size: "", min: null, max: null, sort: "newest" };

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const price = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : null);

/** Reads filters from URL params. Unknown or malformed values are ignored; values are validated against real options by the caller. */
export function parseFilters(sp: Raw): Filters {
  const avail = one(sp.avail);
  const sort = one(sp.sort);
  return {
    comp: one(sp.comp).slice(0, 40),
    sub: (one(sp.type) || one(sp.sub)).slice(0, 40),
    grp: one(sp.group).slice(0, 40),
    brand: one(sp.brand).slice(0, 40),
    avail: avail === "ready" || avail === "preorder" ? avail : "",
    size: one(sp.size).slice(0, 20),
    min: price(one(sp.min)),
    max: price(one(sp.max)),
    sort: sort === "low" || sort === "high" ? sort : "newest",
  };
}

export function toQuery(f: Filters): string {
  const q = new URLSearchParams();
  if (f.comp) q.set("comp", f.comp);
  if (f.sub) q.set("type", f.sub);
  if (f.grp) q.set("group", f.grp);
  if (f.brand) q.set("brand", f.brand);
  if (f.avail) q.set("avail", f.avail);
  if (f.size) q.set("size", f.size);
  if (f.min !== null) q.set("min", String(f.min));
  if (f.max !== null) q.set("max", String(f.max));
  if (f.sort !== "newest") q.set("sort", f.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const hasActive = (f: Filters) => !!(f.comp || f.sub || f.grp || f.brand || f.avail || f.size || f.min !== null || f.max !== null);

export function applyFilters(all: BrowseProduct[], f: Filters, skip?: keyof Filters): BrowseProduct[] {
  const out = all.filter((p) => {
    if (skip !== "comp" && f.comp && p.comp !== f.comp) return false;
    if (skip !== "sub" && f.sub && p.sub !== f.sub) return false;
    if (skip !== "grp" && f.grp && p.grp !== f.grp) return false;
    if (skip !== "brand" && f.brand && p.brand !== f.brand) return false;
    if (skip !== "avail" && f.avail === "ready" && p.badge !== "Ready stock") return false;
    if (skip !== "avail" && f.avail === "preorder" && p.badge !== "Pre-order") return false;
    if (skip !== "size" && f.size && !p.sizes.some((s) => s.size === f.size && s.mode !== "soldout")) return false;
    if (skip !== "min" && f.min !== null && p.priceLkr < f.min) return false;
    if (skip !== "max" && f.max !== null && p.priceLkr > f.max) return false;
    return true;
  });
  if (f.sort === "low") return [...out].sort((a, b) => a.priceLkr - b.priceLkr);
  if (f.sort === "high") return [...out].sort((a, b) => b.priceLkr - a.priceLkr);
  return out; // server order is newest first
}

/** Drops any filter value that does not exist in this category, so a stale or hand-edited URL can never produce a confusing empty page. */
export type ValidGroup = { slug: string; sub: string; brands: string[] };
export function sanitizeFilters(f: Filters, valid: { comps: string[]; subs: string[]; sizes: string[]; groups?: ValidGroup[] }): Filters {
  const sub = valid.subs.includes(f.sub) ? f.sub : "";
  // A subgroup only counts under its own subcategory, and a brand only under its own subgroup.
  const g = (valid.groups ?? []).find((x) => x.slug === f.grp && (!sub || x.sub === sub));
  const grp = g ? g.slug : "";
  return {
    ...f,
    comp: valid.comps.includes(f.comp) ? f.comp : "",
    sub: sub || (g ? g.sub : ""),
    grp,
    brand: g && g.brands.includes(f.brand) ? f.brand : "",
    size: valid.sizes.includes(f.size) ? f.size : "",
    min: f.min !== null && f.max !== null && f.min > f.max ? null : f.min,
  };
}

export const NAV_LABEL: Record<string, string> = {
  football: "Leagues and competitions", "formula-1": "Teams", nba: "Teams", nfl: "Teams", nhl: "Teams", baseball: "Teams", rugby: "Competitions and teams",
};
export const navLabel = (sport: string) => NAV_LABEL[sport] ?? "Browse by competition";

/** [bold word, light word] for the logo-row heading, e.g. TOP LEAGUES. */
export const navHeading = (sport: string): [string, string] =>
  sport === "football" ? ["Top", "Leagues"] : sport === "rugby" ? ["Top", "Competitions"] : ["Top", "Teams"];
