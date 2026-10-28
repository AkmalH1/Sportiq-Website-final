import "server-only";
import { audit, db, tx } from "./db";
import { parseCsv } from "./csv";
import { sizesFor, skuSuffix, stockColumn } from "./config";
import { sportSlugs as listSportSlugs, slugify } from "./categories";
import { parseBrands } from "./brands";

export { CSV_HEADERS } from "./import-headers";
import { CSV_HEADERS } from "./import-headers";

export const CSV_TEMPLATE =
  CSV_HEADERS.join(",") +
  "\n" +
  [
    "nba-sample-jersey", "Sample NBA Jersey", "nba", "Jersey", "Swingman Style", "4900", '"Sample description, with a comma"',
    "published", "yes", "Arrives in 2 to 3 weeks", "", "NBA-SMP", "jerseys", "", "no", "400", "0", "2", "3", "1", "0", "0", "0", "", "", "",
  ].join(",") +
  "\n";

export type PlanLine = { slug: string; name: string; action: "create" | "update"; price: number; status: string; changes: string[] };

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
  /** True when nothing was written: the result only describes what a real import would do. */
  preview?: boolean;
  plan?: PlanLine[];
  notes?: string[];
  /** Total products in the plan (the plan list itself is capped to keep the response small). */
  planTotal?: number;
  /** Which image files belong to which product (Excel exports with local photo paths). */
  photos?: { slug: string; files: string[] }[];
};

const yes = (s: string) => ["yes", "y", "true", "1"].includes(s.trim().toLowerCase());
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function importProductsCsv(text: string, actor: string): Promise<ImportResult> {
  return importProductRows(parseCsv(text), actor);
}

/** dryRun: validate everything and report what would be created or updated, but write nothing. */
export async function importProductRows(rows: string[][], actor: string, opts: { dryRun?: boolean; createSubs?: boolean } = {}): Promise<ImportResult> {
  const result: ImportResult = { ok: false, created: 0, updated: 0, errors: [] };
  if (rows.length < 2) {
    result.errors.push({ row: 0, message: "The file has no data rows." });
    return result;
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  for (const required of ["slug", "name", "sport", "price_lkr", "sku_prefix"]) {
    if (!header.includes(required)) {
      result.errors.push({ row: 1, message: `Missing required column: ${required}` });
    }
  }
  if (result.errors.length) return result;
  if (rows.length - 1 > 10000) {
    result.errors.push({ row: 0, message: "Import at most 10000 rows at a time." });
    return result;
  }

  type Parsed = {
    slug: string; name: string; sport: string; type: string; version: string; price: number; description: string;
    status: string; pre: boolean; eta: string; image: string; prefix: string; sub: string | null; league: string | null; comp: string | null; grp: string | null; brand: string | null; sizes: readonly string[]; custom: boolean | null; weight: number | null; stock: Record<string, number | null>;
  };
  const parsed: Parsed[] = [];
  const photos: { slug: string; files: string[] }[] = [];
  const seenSlugs = new Set<string>();
  const prefixOwner = new Map<string, string>();
  const sportSlugs = new Set(await listSportSlugs());
  const sizeSets = new Map(((await db().prepare("SELECT slug, size_set FROM sports").all()) as { slug: string; size_set: string }[]).map((r) => [r.slug, r.size_set]));
  const hasLeague = header.includes("league");
  const newSubs = new Map<string, { sport: string; slug: string; name: string }>();
  const subRows = (await db().prepare("SELECT sport_slug, slug, name FROM subcategories").all()) as { sport_slug: string; slug: string; name: string }[];
  const hasSub = header.includes("subcategory");
  const hasComp = header.includes("competition");
  const newComps = new Map<string, { sport: string; slug: string; name: string }>();
  const compRows = (await db().prepare("SELECT sport_slug, slug, name FROM competitions").all()) as { sport_slug: string; slug: string; name: string }[];
  const hasGroup = header.includes("subgroup");
  const hasBrand = header.includes("brand");
  type GroupRow = { sport_slug: string; subcategory_slug: string; slug: string; name: string; brands: string };
  const groupRows = (await db().prepare("SELECT sport_slug, subcategory_slug, slug, name, brands FROM subgroups").all()) as GroupRow[];
  const newGroups = new Map<string, GroupRow>();
  const newBrands = new Map<string, { sport: string; group: string; name: string }>();
  const hasCustom = header.includes("customizable");
  const hasWeight = header.includes("weight_g");

  rows.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2;
    const get = (k: string) => (cells[header.indexOf(k.toLowerCase())] ?? "").trim();
    const err = (m: string) => result.errors.push({ row: rowNo, message: m });
    const slug = get("slug");
    const price = Number(get("price_lkr"));
    const prefix = get("sku_prefix").toUpperCase();
    const status = (get("status") || "published").toLowerCase();
    const stock: Record<string, number | null> = {};
    let bad = false;
    if (!SLUG.test(slug)) { err("slug must be lowercase letters, numbers and hyphens"); bad = true; }
    if (seenSlugs.has(slug)) { err(`duplicate slug "${slug}" in this file`); bad = true; }
    seenSlugs.add(slug);
    if (prefix) {
      const owner = prefixOwner.get(prefix);
      if (owner && owner !== slug) { err(`sku_prefix "${prefix}" is already used by "${owner}" in this file. Each product needs its own prefix`); bad = true; }
      else prefixOwner.set(prefix, slug);
    }
    if (!get("name")) { err("name is required"); bad = true; }
    if (!sportSlugs.has(get("sport"))) { err(`sport must be one of: ${[...sportSlugs].join(", ")}`); bad = true; }
    if (!Number.isInteger(price) || price < 0) { err("price_lkr must be a whole number"); bad = true; }
    if (!/^[A-Z0-9-]{2,20}$/.test(prefix)) { err("sku_prefix must be 2 to 20 letters, numbers or hyphens"); bad = true; }
    if (!["published", "draft", "archived"].includes(status)) { err("status must be published, draft or archived"); bad = true; }
    let sub: string | null = null;
    if (hasSub) {
      const v = get("subcategory").toLowerCase();
      if (v === "") sub = "";
      else {
        const m = subRows.find((r) => r.sport_slug === get("sport") && (r.slug === v || r.name.toLowerCase() === v));
        if (!m && opts.createSubs && slugify(v)) {
          // Create it automatically (the owner can rename or reorder it later in Admin, Categories).
          const raw = get("subcategory");
          const ns = { sport: get("sport"), slug: slugify(v), name: raw.charAt(0).toUpperCase() + raw.slice(1) };
          subRows.push({ sport_slug: ns.sport, slug: ns.slug, name: ns.name });
          newSubs.set(`${ns.sport}/${ns.slug}`, ns);
          sub = ns.slug;
        } else if (!m) { err(`subcategory "${get("subcategory")}" does not exist under ${get("sport")}. Add it in Admin, Categories first, or tick "Create new subcategories automatically"`); bad = true; }
        else sub = m.slug;
      }
    }
    let league: string | null = null;
    if (hasLeague) {
      league = get("league").toLowerCase();
      if (["no", "none", "n/a", "-"].includes(league)) league = ""; // "no" in this column means no league
      if (league && !sportSlugs.has(league)) { err(`league must be one of: ${[...sportSlugs].join(", ")} (or empty)`); bad = true; }
    }
    // competition = league / team used by the storefront navigation. It is only ever set from this explicit column: never guessed from a product name.
    let comp: string | null = null;
    if (hasComp) {
      const raw = get("competition");
      const v = raw.toLowerCase();
      if (v === "" || ["no", "none", "n/a", "-"].includes(v)) comp = "";
      else {
        const m = compRows.find((r) => r.sport_slug === get("sport") && (r.slug === v || r.name.toLowerCase() === v || r.slug === slugify(v)));
        if (m) comp = m.slug;
        else if (opts.createSubs && slugify(v)) {
          const ns = { sport: get("sport"), slug: slugify(v), name: raw.length > 80 ? raw.slice(0, 80) : raw };
          compRows.push({ sport_slug: ns.sport, slug: ns.slug, name: ns.name });
          newComps.set(`${ns.sport}/${ns.slug}`, ns);
          comp = ns.slug;
        } else { err(`competition "${raw}" does not exist under ${get("sport")}. Add it in Admin, Categories first, or tick "Create new subcategories automatically"`); bad = true; }
      }
    }
    // subgroup / brand: the third and fourth level under a subcategory. Only ever set from these explicit columns.
    let grp: string | null = null;
    let brand: string | null = null;
    if (hasGroup || hasBrand) {
      const none = (v: string) => ["", "no", "none", "n/a", "-"].includes(v.toLowerCase());
      const gRaw = hasGroup ? get("subgroup") : "";
      const bRaw = hasBrand ? get("brand") : "";
      if (hasBrand && !none(bRaw) && !hasGroup) { err("brand needs a subgroup column in the same file"); bad = true; }
      else if (hasGroup) {
        if (none(gRaw)) { grp = ""; brand = ""; }
        else {
          const v = gRaw.toLowerCase();
          let g = groupRows.find((r) => r.sport_slug === get("sport") && (r.slug === v || r.name.toLowerCase() === v || r.slug === slugify(v)) && (!sub || r.subcategory_slug === sub));
          if (!g && opts.createSubs && sub && slugify(v)) {
            g = { sport_slug: get("sport"), subcategory_slug: sub, slug: slugify(v), name: gRaw.slice(0, 80), brands: "" };
            groupRows.push(g);
            newGroups.set(`${g.sport_slug}/${g.slug}`, g);
          }
          if (!g) { err(`subgroup "${gRaw}" does not exist under ${get("sport")}${sub ? " / " + sub : ""}. Add it in Admin, Categories first, or tick "Create new subcategories automatically" (the subcategory column must then be filled in)`); bad = true; }
          else {
            if (sub && sub !== g.subcategory_slug) { err(`subgroup "${gRaw}" belongs to subcategory ${g.subcategory_slug}, not ${sub}`); bad = true; }
            else if (!sub) sub = g.subcategory_slug;
            grp = g.slug;
            if (hasBrand) {
              if (none(bRaw)) brand = "";
              else {
                const bv = slugify(bRaw);
                const known = parseBrands(g.brands).find((b) => b.slug === bv);
                if (known) brand = known.slug;
                else if (opts.createSubs && bv) {
                  g.brands = g.brands ? `${g.brands}\n${bRaw}` : bRaw;
                  newBrands.set(`${g.sport_slug}/${g.slug}/${bv}`, { sport: g.sport_slug, group: g.slug, name: bRaw.slice(0, 40) });
                  brand = bv;
                } else { err(`brand "${bRaw}" is not listed under subgroup "${g.name}". Add it in Admin, Categories, or tick "Create new subcategories automatically"`); bad = true; }
              }
            }
          }
        }
      }
    }
    const sizes = sizesFor(sizeSets.get(get("sport")) ?? "apparel");
    let weight: number | null = null;
    if (hasWeight && get("weight_g") !== "") {
      weight = Number(get("weight_g"));
      if (!Number.isInteger(weight) || weight < 1 || weight > 20000) { err("weight_g must be a whole number of grams (1 to 20000)"); bad = true; }
    }
    for (const s of sizes) {
      const raw = get(stockColumn(s));
      // Blank means "leave the current stock alone" (new variants start at 0).
      const n = raw === "" ? null : Number(raw);
      if (n !== null && (!Number.isInteger(n) || n < 0)) { err(`${stockColumn(s)} must be a whole number of 0 or more`); bad = true; }
      stock[s] = n;
    }
    // image_url must be a web link or an image already on the site. A file path from the owner's own computer
    // (C:\\...\\shirt_0.jpg) cannot be shown by a browser: it is NOT saved, and becomes a photo to upload from the chosen folder instead.
    let image = get("image_url");
    if (image && !/^https:\/\//i.test(image) && !image.startsWith("/uploads/")) {
      if (/\.(jpe?g|png|webp)$/i.test(image) && !/^https?:/i.test(image)) {
        photos.push({ slug, files: [image.split(/[\\/]+/).filter(Boolean).slice(-2).join("/")] });
        image = "";
      } else { err("image_url must be an https:// link, or a path to a .jpg/.png/.webp file on your computer, or empty"); bad = true; }
    }
    // Excel exports from the scraper keep the photo paths in main_image_local and gallery_images_local (gallery separated by " | ").
    // They become photos to upload from the folder chosen on the import page (matched by folder/file name).
    {
      const local: string[] = [];
      const main = get("main_image_local");
      if (main) local.push(main);
      const gal = get("gallery_images_local");
      if (gal) local.push(...gal.split(/\s*\|\s*|\r?\n/).map((x) => x.trim()).filter(Boolean));
      const files = local.filter((x) => /\.(jpe?g|png|webp)$/i.test(x)).map((x) => x.split(/[\\/]+/).filter(Boolean).slice(-2).join("/"));
      if (files.length) {
        const have = photos.find((q) => q.slug === slug);
        if (have) have.files.push(...files); else photos.push({ slug, files });
      }
    }
    if (!bad) {
      parsed.push({
        slug, name: get("name"), sport: get("sport"), type: get("type"), version: get("version"), price,
        description: get("description"), status, pre: yes(get("preorder_enabled")), eta: get("preorder_eta"),
        image, prefix, sub, league, comp, grp, brand, sizes, custom: hasCustom ? yes(get("customizable")) : null, weight, stock,
      });
    }
  });

  // All-or-nothing: if any row is invalid, nothing is written.
  if (result.errors.length) return result;

  // Work out exactly what will change, and catch SKUs that belong to another product, before anything is written.
  const plan: PlanLine[] = [];
  for (const p of parsed) {
    const ex = (await db().prepare("SELECT id, name, price_lkr, status, sport_slug FROM products WHERE slug = ?").get(p.slug)) as
      { id: number; name: string; price_lkr: number; status: string; sport_slug: string } | undefined;
    const changes: string[] = [];
    if (ex) {
      if (ex.name !== p.name) changes.push(`name: ${ex.name} → ${p.name}`);
      if (Number(ex.price_lkr) !== p.price) changes.push(`price: ${ex.price_lkr} → ${p.price}`);
      if (ex.status !== p.status) changes.push(`status: ${ex.status} → ${p.status}`);
      if (ex.sport_slug !== p.sport) changes.push(`category: ${ex.sport_slug} → ${p.sport}`);
    }
    for (const size of p.sizes) {
      const sku = `${p.prefix}-${skuSuffix(size)}`;
      const cur = (await db().prepare("SELECT stock, product_id FROM variants WHERE sku = ?").get(sku)) as { stock: number; product_id: number } | undefined;
      if (cur && (!ex || cur.product_id !== ex.id)) result.errors.push({ row: 0, message: `SKU ${sku} (${p.slug}) already belongs to another product` });
      if (ex && cur && p.stock[size] !== null && Number(cur.stock) !== p.stock[size]) changes.push(`stock ${size}: ${cur.stock} → ${p.stock[size]}`);
    }
    plan.push({ slug: p.slug, name: p.name, action: ex ? "update" : "create", price: p.price, status: p.status, changes });
  }
  if (result.errors.length) return result;
  if (photos.length) result.photos = photos;
  if (newComps.size) (result.notes ??= []).push(`${newComps.size} new competition${newComps.size === 1 ? "" : "s"} will be created: ${[...newComps.values()].map((x) => `${x.sport} / ${x.name}`).join(", ")}.`);
  if (newGroups.size) (result.notes ??= []).push(`${newGroups.size} new subgroup${newGroups.size === 1 ? "" : "s"} will be created: ${[...newGroups.values()].map((x) => `${x.sport_slug} / ${x.name}`).join(", ")}.`);
  if (newBrands.size) (result.notes ??= []).push(`${newBrands.size} new brand${newBrands.size === 1 ? "" : "s"} will be added to subgroups: ${[...newBrands.values()].map((x) => x.name).join(", ")}.`);
  if (newSubs.size) result.notes = [...(result.notes ?? []), `${newSubs.size} new subcategor${newSubs.size === 1 ? "y" : "ies"} will be created: ${[...newSubs.values()].map((x) => `${x.sport} / ${x.name}`).join(", ")}.`];
  result.planTotal = plan.length;
  result.plan = plan.slice(0, 300);
  if (opts.dryRun) {
    result.ok = true;
    result.preview = true;
    result.created = plan.filter((x) => x.action === "create").length;
    result.updated = plan.length - result.created;
    return result;
  }

  try {
  await tx(async (d) => {
    result.created = 0;
    result.updated = 0;
    // Earlier imports may have saved a computer file path as the image: it can never display, so clear it (a real photo is added afterwards).
    await d.prepare("UPDATE products SET image_url = '' WHERE image_url <> '' AND image_url NOT LIKE '/%' AND image_url NOT LIKE 'https://%'").run();
    for (const ns of newSubs.values()) {
      const has = await d.prepare("SELECT id FROM subcategories WHERE sport_slug = ? AND slug = ?").get(ns.sport, ns.slug);
      if (!has) {
        const next = ((await d.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM subcategories WHERE sport_slug = ?").get(ns.sport)) as { n: number }).n;
        await d.prepare("INSERT INTO subcategories (sport_slug, slug, name, sort) VALUES (?,?,?,?)").run(ns.sport, ns.slug, ns.name, next);
      }
    }
    for (const nc of newComps.values()) {
      const has = await d.prepare("SELECT id FROM competitions WHERE sport_slug = ? AND slug = ?").get(nc.sport, nc.slug);
      if (!has) {
        const next = ((await d.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM competitions WHERE sport_slug = ?").get(nc.sport)) as { n: number }).n;
        await d.prepare("INSERT INTO competitions (sport_slug, slug, name, sort) VALUES (?,?,?,?)").run(nc.sport, nc.slug, nc.name, next);
      }
    }
    for (const ng of newGroups.values()) {
      const has = await d.prepare("SELECT id FROM subgroups WHERE sport_slug = ? AND slug = ?").get(ng.sport_slug, ng.slug);
      if (!has) {
        const next = ((await d.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM subgroups WHERE sport_slug = ? AND subcategory_slug = ?").get(ng.sport_slug, ng.subcategory_slug)) as { n: number }).n;
        await d.prepare("INSERT INTO subgroups (sport_slug, subcategory_slug, slug, name, brands, sort) VALUES (?,?,?,?,?,?)").run(ng.sport_slug, ng.subcategory_slug, ng.slug, ng.name, "", next);
      }
    }
    for (const nb of newBrands.values()) {
      const g = (await d.prepare("SELECT brands FROM subgroups WHERE sport_slug = ? AND slug = ? FOR UPDATE").get(nb.sport, nb.group)) as { brands: string } | undefined;
      if (g) await d.prepare("UPDATE subgroups SET brands = ? WHERE sport_slug = ? AND slug = ?").run(parseBrands(`${g.brands}\n${nb.name}`).map((b) => b.name).join("\n"), nb.sport, nb.group);
    }
    for (const p of parsed) {
      const existing = (await d.prepare("SELECT id FROM products WHERE slug = ?").get(p.slug)) as { id: number } | undefined;
      let id: number;
      if (existing) {
        id = existing.id;
        await d.prepare(
          // Blank optional cells keep the value already on the product (so re-importing never wipes photos or descriptions).
          `UPDATE products SET name=?, sport_slug=?, type=COALESCE(NULLIF(?,''),type), version=COALESCE(NULLIF(?,''),version), price_lkr=?,
             description=COALESCE(NULLIF(?,''),description), status=?, preorder_enabled=?, preorder_eta=COALESCE(NULLIF(?,''),preorder_eta),
             image_url=COALESCE(NULLIF(?,''),image_url), is_demo=0 WHERE id=?`,
        ).run(p.name, p.sport, p.type, p.version, p.price, p.description, p.status, p.pre ? 1 : 0, p.eta, p.image, id);
        if (p.sub !== null) await d.prepare("UPDATE products SET subcategory_slug=? WHERE id=?").run(p.sub, id);
        if (p.league !== null) await d.prepare("UPDATE products SET league_slug=? WHERE id=?").run(p.league, id);
        if (p.comp !== null) await d.prepare("UPDATE products SET competition_slug=? WHERE id=?").run(p.comp, id);
        if (p.grp !== null) {
          // Changing the subgroup clears the old brand unless this file gives one.
          await d.prepare("UPDATE products SET brand_slug = CASE WHEN subgroup_slug = ? THEN brand_slug ELSE '' END, subgroup_slug = ? WHERE id=?").run(p.grp, p.grp, id);
          if (p.brand !== null) await d.prepare("UPDATE products SET brand_slug=? WHERE id=?").run(p.brand, id);
        }
        if (p.custom !== null) await d.prepare("UPDATE products SET customizable=? WHERE id=?").run(p.custom ? 1 : 0, id);
        if (p.weight !== null) await d.prepare("UPDATE products SET weight_g=? WHERE id=?").run(p.weight, id);
        result.updated++;
      } else {
        const r = await d
          .prepare(
            `INSERT INTO products (slug,name,sport_slug,type,version,price_lkr,description,status,preorder_enabled,preorder_eta,image_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(p.slug, p.name, p.sport, p.type, p.version, p.price, p.description, p.status, p.pre ? 1 : 0, p.eta, p.image);
        id = r.lastInsertRowid;
        await d.prepare("UPDATE products SET subcategory_slug=?, customizable=?, weight_g=?, league_slug=?, competition_slug=?, subgroup_slug=?, brand_slug=? WHERE id=?").run(p.sub ?? "", p.custom ? 1 : 0, p.weight ?? 400, p.league ?? "", p.comp ?? "", p.grp ?? "", p.brand ?? "", id);
        result.created++;
      }
      for (const size of p.sizes) {
        const sku = `${p.prefix}-${skuSuffix(size)}`;
        const cur = (await d.prepare("SELECT stock, product_id FROM variants WHERE sku = ?").get(sku)) as { stock: number; product_id: number } | undefined;
        if (cur && cur.product_id !== id) throw new Error(`SKU ${sku} already belongs to another product`);
        const want = p.stock[size];
        if (!cur) {
          const n = want ?? 0;
          await d.prepare("INSERT INTO variants (sku, product_id, size, stock) VALUES (?,?,?,?)").run(sku, id, size, n);
          if (n !== 0) await d.prepare("INSERT INTO inventory_movements (sku, delta, reason) VALUES (?,?, 'import')").run(sku, n);
        } else if (want !== null && cur.stock !== want) {
          await d.prepare("UPDATE variants SET stock = ? WHERE sku = ?").run(want, sku);
          await d.prepare("INSERT INTO inventory_movements (sku, delta, reason) VALUES (?,?, 'import adjustment')").run(sku, want - cur.stock);
        }
      }
    }
  });
  } catch (e) {
    result.created = 0;
    result.updated = 0;
    result.errors.push({ row: 0, message: e instanceof Error ? e.message : "Import failed" });
    return result;
  }
  await audit(actor, "products.import", `${result.created} created, ${result.updated} updated`);
  result.ok = true;
  return result;
}
