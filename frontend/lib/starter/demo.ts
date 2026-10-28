import type { Handle } from "../db";

/** DEMO DATA. Replace through the admin area (bulk CSV import) before launch. */

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

type Seed = {
  slug: string;
  name: string;
  sport: string;
  type: string;
  version: string;
  price: number;
  pre: boolean;
  eta: string;
  stock: number[]; // S, M, L, XL, 2XL, 3XL
  code: string;
  description: string;
};

const ETA = "Arrives in 2 to 3 weeks";

const products: Seed[] = [
  { slug: "demo-barcelona-home-jersey", name: "Barcelona Home Jersey", sport: "football", type: "Club Jersey", version: "Fan Version", price: 4550, pre: true, eta: ETA, stock: [0, 3, 5, 0, 0, 0], code: "BAR-HOME", description: "Demo product. Fan-version club jersey." },
  { slug: "demo-retro-archive-jersey", name: "Retro Archive Club Jersey", sport: "football", type: "Retro Jersey", version: "Fan Version", price: 5200, pre: true, eta: ETA, stock: [0, 0, 0, 0, 0, 0], code: "RET-CLUB", description: "Demo product. Throwback club shirt." },
  { slug: "demo-nba-court-jersey", name: "Court Edition NBA Jersey", sport: "nba", type: "Jersey", version: "Swingman Style", price: 4900, pre: true, eta: ETA, stock: [2, 4, 4, 1, 0, 0], code: "NBA-CRT", description: "Demo product. Swingman-style basketball jersey." },
  { slug: "demo-nfl-gridiron-jersey", name: "Gridiron NFL Jersey", sport: "nfl", type: "Jersey", version: "Game Style", price: 5600, pre: true, eta: ETA, stock: [0, 0, 0, 0, 0, 0], code: "NFL-GRD", description: "Demo product. Game-style football jersey." },
  { slug: "demo-f1-paddock-polo", name: "Paddock Polo", sport: "formula-1", type: "Team Polo", version: "Fan Version", price: 5800, pre: false, eta: "", stock: [0, 2, 3, 2, 0, 0], code: "F1-POLO", description: "Demo product. Ready stock only, no pre-order." },
  { slug: "demo-rugby-heritage-shirt", name: "Heritage Rugby Shirt", sport: "rugby", type: "Match Shirt", version: "Fan Version", price: 5400, pre: true, eta: ETA, stock: [0, 0, 2, 0, 0, 0], code: "RGB-HER", description: "Demo product. Heritage rugby shirt." },
  { slug: "demo-baseball-diamond-jersey", name: "Diamond Baseball Jersey", sport: "baseball", type: "Jersey", version: "Fan Version", price: 4700, pre: true, eta: ETA, stock: [3, 3, 2, 0, 0, 0], code: "BSB-DIA", description: "Demo product. Button-up baseball jersey." },
  { slug: "demo-street-nba-jersey", name: "Street NBA Jersey", sport: "nba", type: "Jersey", version: "Standard", price: 4300, pre: true, eta: ETA, stock: [5, 6, 6, 4, 2, 0], code: "BKB-STR", description: "Demo product. Street basketball jersey." },
];

const caps = [
  { slug: "demo-nba-fitted-cap", name: "Court Fitted Cap", sub: "fitted", league: "nba", price: 3200, code: "CAP-NBA-FIT", stock: 6 },
  { slug: "demo-nfl-snapback-cap", name: "Gridiron Snapback", sub: "snapback", league: "nfl", price: 3400, code: "CAP-NFL-SNP", stock: 0 },
  { slug: "demo-baseball-dad-hat", name: "Diamond Dad Hat", sub: "dad-hats", league: "baseball", price: 2900, code: "CAP-BSB-DAD", stock: 9 },
  { slug: "demo-f1-team-cap", name: "Paddock Team Cap", sub: "adjustable", league: "formula-1", price: 3600, code: "CAP-F1-ADJ", stock: 4 },
  { slug: "demo-football-beanie", name: "Terrace Beanie", sub: "beanies", league: "football", price: 2600, code: "CAP-FBL-BEN", stock: 0 },
  { slug: "demo-nhl-snapback-cap", name: "Ice Snapback", sub: "snapback", league: "nhl", price: 3400, code: "CAP-NHL-SNP", stock: 3 },
];

async function addCaps(d: Handle) {
  for (const c of caps) {
    const r = await d
      .prepare(
        `INSERT INTO products (slug,name,sport_slug,type,version,price_lkr,description,status,preorder_enabled,preorder_eta,is_demo,subcategory_slug,league_slug,weight_g)
         VALUES (?,?,?,?,?,?,?,'published',1,'Arrives in 2 to 3 weeks',1,?,?,200)`,
      )
      .run(c.slug, c.name, "caps", "Cap", "Standard", c.price, "Demo product. One size headwear.", c.sub, c.league);
    await d.prepare("INSERT INTO variants (sku,product_id,size,stock) VALUES (?,?,?,?)").run(`${c.code}-OS`, r.lastInsertRowid, "One Size", c.stock);
    if (c.stock > 0) await d.prepare("INSERT INTO inventory_movements (sku,delta,reason) VALUES (?,?,'seed')").run(`${c.code}-OS`, c.stock);
  }
}

const subFor = (p: Seed) =>
  ["nba", "nfl", "nhl"].includes(p.sport) ? "jerseys"
  : p.sport === "rugby" || p.sport === "baseball" ? "shirts"
  : p.sport === "formula-1" ? "polos"
  : /retro/i.test(p.type) ? "retro-archive"
  : "club-jerseys";

/** Demo products for trying the site. Only used when SEED_DEMO_DATA=true on an empty catalogue. Replace through bulk import before launch. */
export async function seedDemo(d: Handle) {
  for (const p of products) {
    const r = await d
      .prepare(
        "INSERT INTO products (slug,name,sport_slug,type,version,price_lkr,description,status,preorder_enabled,preorder_eta,is_demo,customizable,subcategory_slug) VALUES (?,?,?,?,?,?,?,'published',?,?,1,?,?)",
      )
      .run(p.slug, p.name, p.sport, p.type, p.version, p.price, p.description, p.pre ? 1 : 0, p.eta, p.sport === "football" ? 1 : 0, subFor(p));
    for (const [i, size] of SIZES.entries()) {
      const sku = `${p.code}-${size}`;
      await d.prepare("INSERT INTO variants (sku,product_id,size,stock) VALUES (?,?,?,?)").run(sku, r.lastInsertRowid, size, p.stock[i]);
      if (p.stock[i] > 0) await d.prepare("INSERT INTO inventory_movements (sku,delta,reason) VALUES (?,?,'seed')").run(sku, p.stock[i]);
    }
  }
  await addCaps(d);
}
