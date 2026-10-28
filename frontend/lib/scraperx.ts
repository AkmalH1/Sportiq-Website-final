/**
 * Converts a ScraperX workbook (columns: Product Name, SKU, Cost Price, Sell Price, Description, Category, Sizes, image paths…)
 * into the rows the SPORTIQ importer understands. Pure functions, no database: safe to unit test.
 */
import { CSV_HEADERS } from "./import-headers.ts";

export type Sheet = { name: string; rows: unknown[][] };

export type ScraperxOptions = {
  /** Added on top of Cost Price when Sell Price is 0 or blank. */
  markupPct: number;
  /** Sport slug every product goes into (must already exist). */
  sport: string;
  status: "draft" | "published";
  preorder: boolean;
  preorderEta: string;
};

export type PhotoEntry = { slug: string; source: string; target: string };

export type ScraperxResult = {
  rows: string[][]; // header row + data rows, ready for the importer
  errors: { row: number; message: string }[];
  notes: string[];
  photos: PhotoEntry[];
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
export const slugifyName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SIZE_MAP: Record<string, string> = {
  s: "S", small: "S",
  m: "M", medium: "M",
  l: "L", large: "L",
  xl: "XL", "xtra large": "XL", "extra large": "XL", "x large": "XL",
  xxl: "2XL", "2xl": "2XL", "xx large": "2XL", "2x large": "2XL",
  xxxl: "3XL", "3xl": "3XL", "xxx large": "3XL",
};

/** Stable short SKU prefix for products that have no SKU in the sheet: same name always gives the same prefix, so re-imports update instead of duplicating. */
export function autoPrefix(slug: string): string {
  let h = 2166136261;
  for (const ch of slug) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `SIQ-${h.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

export const isScraperx = (headers: string[]) => {
  const h = headers.map((x) => x.trim().toLowerCase());
  return h.includes("product name") && h.includes("sku") && (h.includes("cost price") || h.includes("sell price"));
};

function cleanName(raw: string) {
  return raw.replace(/^\s*buy\s+/i, "").replace(/\s+customi[sz]able\s*$/i, "").replace(/\s+/g, " ").trim();
}

export function convertScraperx(sheets: Sheet[], opt: ScraperxOptions): ScraperxResult {
  const out: ScraperxResult = { rows: [], errors: [], notes: [], photos: [] };
  type Item = { cells: Record<string, string>; sheet: string; line: number };
  const items: Item[] = [];
  for (const sh of sheets) {
    if (!sh.rows.length) continue;
    const head = sh.rows[0].map(str);
    if (!isScraperx(head)) continue;
    const lower = head.map((h) => h.toLowerCase());
    sh.rows.slice(1).forEach((r, i) => {
      if (r.every((c) => str(c) === "")) return;
      const cells: Record<string, string> = {};
      lower.forEach((h, k) => { cells[h] = str(r[k]); });
      // No SKU in the sheet: make one from the product name (the same on every sheet, and on every re-import).
      if (!cells["sku"] || cells["sku"].toLowerCase() === "none") cells["sku"] = autoPrefix(slugifyName(cleanName(cells["product name"] ?? "")));
      items.push({ cells, sheet: sh.name, line: i + 2 });
    });
  }
  if (!items.length) {
    out.errors.push({ row: 0, message: 'No product rows found. Expected a sheet with the columns "Product Name" and "SKU".' });
    return out;
  }

  // The same SKU can appear on several sheets (one sheet has prices, another has sizes). Use the highest cost and the first sizes seen.
  const costBySku = new Map<string, number>();
  const sellBySku = new Map<string, number>();
  const sizesBySku = new Map<string, string>();
  for (const it of items) {
    const sku = it.cells["sku"];
    costBySku.set(sku, Math.max(costBySku.get(sku) ?? 0, num(it.cells["cost price"])));
    sellBySku.set(sku, Math.max(sellBySku.get(sku) ?? 0, num(it.cells["sell price"])));
    if (it.cells["sizes"] && !sizesBySku.has(sku)) sizesBySku.set(sku, it.cells["sizes"]);
  }

  const seenSku = new Set<string>();
  const usedSlugs = new Set<string>();
  const dataRows: string[][] = [];
  let dropped = 0;
  const unknownSizes = new Set<string>();

  for (const it of items) {
    const c = it.cells;
    const sku = c["sku"].toUpperCase();
    if (seenSku.has(sku)) { dropped++; continue; } // duplicate across sheets: first wins, details were merged above
    seenSku.add(sku);
    const where = `${it.sheet}, row ${it.line}`;
    const err = (m: string) => out.errors.push({ row: it.line, message: `${where}: ${m}` });

    const rawName = c["product name"];
    const name = cleanName(rawName);
    if (!name) { err("Product Name is empty"); continue; }
    if (!/^[A-Z0-9-]{2,20}$/.test(sku)) { err(`SKU "${c["sku"]}" must be 2 to 20 letters, numbers or hyphens`); continue; }

    let slug = slugifyName(name);
    if (usedSlugs.has(slug)) slug = `${slug}-${sku.toLowerCase()}`;
    usedSlugs.add(slug);

    const sell = sellBySku.get(c["sku"]) ?? 0;
    const cost = costBySku.get(c["sku"]) ?? 0;
    const price = sell > 0 ? sell : cost > 0 ? Math.round(cost * (1 + opt.markupPct / 100)) : 0;
    if (price <= 0) { err("no price. Fill Sell Price or Cost Price in the sheet"); continue; }

    for (const label of (sizesBySku.get(c["sku"]) ?? "").split("|").map((x) => x.trim()).filter(Boolean)) {
      const m = SIZE_MAP[label.toLowerCase()];
      if (!m) unknownSizes.add(label);
    }

    const text = `${name} ${c["category"]}`;
    const retro = /retro/i.test(text);
    const desc = c["description"].length <= 300 ? c["description"] : "";

    const rec: Record<string, string> = {
      slug, name, sport: opt.sport, type: retro ? "Retro Jersey" : "Jersey", version: "Fan Version", price_lkr: String(price),
      description: desc, status: opt.status, preorder_enabled: opt.preorder ? "yes" : "no", preorder_eta: opt.preorder ? opt.preorderEta : "",
      image_url: "", sku_prefix: sku, subcategory: opt.sport === "football" ? (retro ? "retro-archive" : "club-jerseys") : "",
      league: "", customizable: /customi[sz]able/i.test(rawName) ? "yes" : "no", weight_g: "",
    };
    dataRows.push(CSV_HEADERS.map((h) => rec[h] ?? ""));

    // Photos: main image plus up to 4 gallery images, renamed so the bulk photo uploader attaches them by slug.
    const main = c["main image — full path"];
    const gallery = (c["gallery images — full paths"] ?? "").split("|").map((x) => x.trim()).filter(Boolean);
    const files = [main, ...gallery].filter(Boolean).slice(0, 5);
    files.forEach((src, idx) => {
      const ext = (/\.(jpe?g|png|webp)$/i.exec(src)?.[1] ?? "").toLowerCase().replace("jpeg", "jpg");
      if (!ext) return;
      out.photos.push({ slug, source: src, target: `${slug}${idx === 0 ? "" : `-${idx + 1}`}.${ext}` });
    });
  }

  if (dropped) out.notes.push(`${dropped} duplicate SKU row(s) across sheets were merged.`);
  if (unknownSizes.size) { const u = [...unknownSizes]; out.notes.push(`${u.length} value(s) in the Sizes column are not sizes and were ignored (for example: ${u.slice(0, 4).join(", ")}). Normal sizes S to 3XL are always created.`); }
  out.notes.push("The sheet has no quantities, so stock is left blank: new products start at 0 and existing stock is not touched.");
  if (dataRows.length) out.rows = [[...CSV_HEADERS], ...dataRows];
  return out;
}

export type PhotoPlan = { slug: string; files: string[] }[];

/** Per product, the image files to attach, as "folder/file.jpg" (last two path parts) so the browser can match them against the folder the owner picks. */
export function photoPlan(photos: PhotoEntry[]): PhotoPlan {
  const by = new Map<string, string[]>();
  for (const p of photos) {
    const parts = p.source.split(/[\\/]+/).filter(Boolean);
    const key = parts.slice(-2).join("/");
    by.set(p.slug, [...(by.get(p.slug) ?? []), key]);
  }
  return [...by.entries()].map(([slug, files]) => ({ slug, files }));
}
