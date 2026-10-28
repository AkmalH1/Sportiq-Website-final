import "server-only";
import { db, likeEscape } from "./db";
import type { Banner, Product, SizeState, Variant } from "./types";
import type { BrowseProduct } from "./browse";
import { SIZES } from "./config";

type ProductRow = {
  id: number; slug: string; name: string; sport_slug: string; type: string; version: string;
  price_lkr: number; description: string; status: Product["status"]; preorder_enabled: number;
  preorder_eta: string; image_url: string; is_demo: number;
  subcategory_slug: string; league_slug: string; competition_slug?: string; subgroup_slug?: string; brand_slug?: string; customizable: number; weight_g: number; gallery: string;
};

function parseGallery(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function hydrate(rows: ProductRow[]): Promise<Product[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const vrows = (await db()
    .prepare(`SELECT sku, product_id, size, stock FROM variants WHERE product_id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids)) as (Variant & { product_id: number })[];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    sportSlug: r.sport_slug,
    type: r.type,
    version: r.version,
    priceLkr: r.price_lkr,
    description: r.description,
    status: r.status,
    preorderEnabled: !!r.preorder_enabled,
    preorderEta: r.preorder_eta,
    imageUrl: r.image_url,
    isDemo: !!r.is_demo,
    subcategorySlug: r.subcategory_slug,
    leagueSlug: r.league_slug,
    competitionSlug: r.competition_slug ?? "",
    subgroupSlug: r.subgroup_slug ?? "",
    brandSlug: r.brand_slug ?? "",
    customizable: !!r.customizable,
    weightG: r.weight_g,
    gallery: parseGallery(r.gallery),
    variants: vrows
      .filter((v) => v.product_id === r.id)
      .map(({ sku, size, stock }) => ({ sku, size, stock }))
      .sort((a, b) => SIZES.indexOf(a.size as never) - SIZES.indexOf(b.size as never)),
  }));
}

export async function listProducts(opts: { sport?: string; sub?: string; league?: string; competition?: string; q?: string; includeUnpublished?: boolean } = {}): Promise<Product[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (!opts.includeUnpublished) where.push("status = 'published'");
  if (opts.sport) {
    where.push("sport_slug = ?");
    args.push(opts.sport);
  }
  if (opts.league) {
    where.push("league_slug = ?");
    args.push(opts.league);
  }
  if (opts.competition) {
    where.push("competition_slug = ?");
    args.push(opts.competition);
  }
  if (opts.sub) {
    where.push("subcategory_slug = ?");
    args.push(opts.sub);
  }
  if (opts.q) {
    where.push(
      "(name LIKE ? OR type LIKE ? OR sport_slug LIKE ? OR version LIKE ? OR id IN (SELECT product_id FROM variants WHERE sku LIKE ?))",
    );
    const like = `%${likeEscape(opts.q)}%`;
    args.push(like, like, like, like, like);
  }
  const sql = `SELECT * FROM products ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`;
  return hydrate((await db().prepare(sql).all(...args)) as ProductRow[]);
}

export async function getProductBySlug(slug: string, includeUnpublished = false): Promise<Product | null> {
  const row = (await db().prepare("SELECT * FROM products WHERE slug = ?").get(slug)) as ProductRow | undefined;
  if (!row) return null;
  if (!includeUnpublished && row.status !== "published") return null;
  return (await hydrate([row]))[0];
}

export function sizeStates(p: Product): SizeState[] {
  return p.variants.map((v) => ({
    size: v.size,
    sku: v.sku,
    stock: v.stock,
    mode: v.stock > 0 ? "ready" : p.preorderEnabled ? "preorder" : "soldout",
  }));
}

export function productBadge(p: Product): "Ready stock" | "Pre-order" | "Sold out" {
  const s = sizeStates(p);
  if (s.some((x) => x.mode === "ready")) return "Ready stock";
  if (s.some((x) => x.mode === "preorder")) return "Pre-order";
  return "Sold out";
}

type BannerRow = {
  id: number; position: Banner["position"]; sort: number; eyebrow: string; title: string; body: string;
  cta_label: string; cta_href: string; from_color: string; to_color: string; image_url: string; active: number;
};

export async function listBanners(position?: Banner["position"], includeInactive = false): Promise<Banner[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (position) {
    where.push("`position` = ?");
    args.push(position);
  }
  if (!includeInactive) where.push("active = 1");
  const rows = (await db()
    .prepare(`SELECT * FROM banners ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY `+"`position`"+`, sort, id`)
    .all(...args)) as BannerRow[];
  return rows.map((r) => ({
    id: r.id, position: r.position, sort: r.sort, eyebrow: r.eyebrow, title: r.title, body: r.body,
    ctaLabel: r.cta_label, ctaHref: r.cta_href, fromColor: r.from_color, toColor: r.to_color,
    imageUrl: r.image_url, active: !!r.active,
  }));
}


/** Slim, serialisable card data (no description or gallery) for the client-side catalogue browser. */
export function toBrowse(p: Product): BrowseProduct {
  return {
    slug: p.slug, name: p.name, imageUrl: p.imageUrl, sportSlug: p.sportSlug, isDemo: p.isDemo, type: p.type, version: p.version,
    priceLkr: p.priceLkr, badge: productBadge(p), sizes: sizeStates(p).map((s) => ({ size: s.size, mode: s.mode })),
    sub: p.subcategorySlug, comp: p.competitionSlug, grp: p.subgroupSlug, brand: p.brandSlug,
  };
}
