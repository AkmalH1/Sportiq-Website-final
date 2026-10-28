import test from "node:test";
import assert from "node:assert/strict";
import { applyFilters, EMPTY_FILTERS, parseFilters, sanitizeFilters, toQuery, type BrowseProduct } from "../../lib/browse.ts";

const mk = (slug: string, o: Partial<BrowseProduct> = {}): BrowseProduct => ({
  slug, name: slug, imageUrl: "", sportSlug: "football", isDemo: false, type: "Jersey", version: "Fan", priceLkr: 5000,
  badge: "Ready stock", sizes: [{ size: "M", mode: "ready" }, { size: "L", mode: "soldout" }], sub: "club", comp: "premier-league", ...o,
});
const data = [
  mk("a"),
  mk("b", { comp: "la-liga", priceLkr: 7000, badge: "Pre-order", sizes: [{ size: "M", mode: "preorder" }, { size: "XL", mode: "preorder" }] }),
  mk("c", { comp: "la-liga", sub: "retro", priceLkr: 3000, badge: "Sold out", sizes: [{ size: "M", mode: "soldout" }] }),
  mk("d", { comp: "", priceLkr: 9000 }),
];
const slugs = (r: BrowseProduct[]) => r.map((p) => p.slug).join(",");

test("competition filter returns only that competition and never unassigned products", () => {
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, comp: "la-liga" })), "b,c");
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, comp: "premier-league" })), "a");
});
test("reset restores everything in original order", () => {
  assert.equal(slugs(applyFilters(data, EMPTY_FILTERS)), "a,b,c,d");
});
test("filters combine (AND)", () => {
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, comp: "la-liga", avail: "preorder" })), "b");
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, comp: "la-liga", sub: "retro" })), "c");
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, comp: "la-liga", avail: "ready" })), "");
});
test("size filter only matches sizes that can actually be ordered", () => {
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, size: "L" })), ""); // L is sold out on a
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, size: "XL" })), "b");
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, size: "M" })), "a,b,d"); // c has M sold out
});
test("price range and sort", () => {
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, min: 4000, max: 8000 })), "a,b");
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, sort: "low" })), "c,a,b,d");
  assert.equal(slugs(applyFilters(data, { ...EMPTY_FILTERS, sort: "high" })), "d,b,a,c");
});
test("URL round trip and hostile params", () => {
  const f = parseFilters({ comp: "la-liga", avail: "preorder", min: "3000", sort: "low", type: "retro" });
  assert.deepEqual(parseFilters(Object.fromEntries(new URLSearchParams(toQuery(f)))), f);
  const bad = parseFilters({ avail: "<script>", min: "-5", max: "1e9", sort: "popular", comp: ["x", "y"] });
  assert.equal(bad.avail, ""); assert.equal(bad.min, null); assert.equal(bad.max, null); assert.equal(bad.sort, "newest"); assert.equal(bad.comp, "x");
});
test("unknown values in a URL are dropped, not turned into an empty page", () => {
  const f = sanitizeFilters({ ...EMPTY_FILTERS, comp: "nope", sub: "club", size: "9XL", min: 9, max: 1 }, { comps: ["la-liga"], subs: ["club"], sizes: ["M"] });
  assert.equal(f.comp, ""); assert.equal(f.sub, "club"); assert.equal(f.size, ""); assert.equal(f.min, null);
});
test("subgroup and brand filters narrow results and survive the URL", () => {
  const withG = data.map((p, i) => ({ ...p, sub: i < 3 ? "kits" : "other", grp: i < 2 ? "club" : i === 2 ? "retro" : "", brand: i === 0 ? "nike" : i === 1 ? "adidas" : "" }));
  assert.equal(slugs(applyFilters(withG, { ...EMPTY_FILTERS, grp: "club" })), "a,b");
  assert.equal(slugs(applyFilters(withG, { ...EMPTY_FILTERS, grp: "club", brand: "nike" })), "a");
  const f = parseFilters({ type: "kits", group: "club", brand: "nike" });
  assert.deepEqual(parseFilters(Object.fromEntries(new URLSearchParams(toQuery(f)))), f);
});
test("a subgroup or brand is dropped unless it belongs under the chosen parent", () => {
  const valid = { comps: [], subs: ["kits", "other"], sizes: [], groups: [{ slug: "club", sub: "kits", brands: ["nike"] }] };
  const ok = sanitizeFilters({ ...EMPTY_FILTERS, sub: "kits", grp: "club", brand: "nike" }, valid);
  assert.equal(ok.grp, "club"); assert.equal(ok.brand, "nike");
  const wrongSub = sanitizeFilters({ ...EMPTY_FILTERS, sub: "other", grp: "club", brand: "nike" }, valid);
  assert.equal(wrongSub.grp, ""); assert.equal(wrongSub.brand, "");
  const wrongBrand = sanitizeFilters({ ...EMPTY_FILTERS, sub: "kits", grp: "club", brand: "puma" }, valid);
  assert.equal(wrongBrand.grp, "club"); assert.equal(wrongBrand.brand, "");
  const noSub = sanitizeFilters({ ...EMPTY_FILTERS, grp: "club" }, valid);
  assert.equal(noSub.sub, "kits"); assert.equal(noSub.grp, "club");
  assert.equal(sanitizeFilters({ ...EMPTY_FILTERS, grp: "ghost", brand: "nike" }, valid).brand, "");
});
