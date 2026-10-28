import "server-only";
import type { Handle } from "./db";
import { SCHEMA } from "./schema";
import { DEFAULT_BANNERS, DEFAULT_COLLECTIONS, DEFAULT_FAQS, DEFAULT_SPORTS, DEFAULT_ZONES, SUB_CHARTS } from "./starter/content";
import { SETTING_DEFAULTS } from "./settings-defaults";
import { seedDemo } from "./starter/demo";
import { DEFAULT_COMPETITIONS } from "./starter/competitions";

type Migration = { id: number; name: string; up: (d: Handle) => Promise<void> };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Ordered, append-only list. Each migration runs once and is recorded in schema_migrations.
 * To change the database after launch, add a new entry at the end. Never edit one that has already shipped.
 */
const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "initial schema",
    up: async (d) => {
      for (const sql of SCHEMA) await d.exec(sql.replace(/^CREATE TABLE/, "CREATE TABLE IF NOT EXISTS")); // safe to re-run if a previous start was interrupted
    },
  },
  {
    id: 2,
    name: "starter content (editable in admin afterwards)",
    up: async (d) => {
      for (const [k, v] of Object.entries(SETTING_DEFAULTS)) await d.prepare("INSERT INTO settings (`key`, value) VALUES (?, ?)").run(k, v);
      for (const [i, s] of DEFAULT_SPORTS.entries()) {
        await d.prepare("INSERT INTO sports (slug,name,tagline,accent,sort,size_set,size_chart) VALUES (?,?,?,?,?,?,?)")
          .run(s.slug, s.name, s.tagline, s.accent, i, s.sizeSet ?? "apparel", s.sizeChart ?? "");
        for (const [j, n] of s.subs.entries()) {
          const slug = slugify(n);
          await d.prepare("INSERT INTO subcategories (sport_slug,slug,name,sort,size_chart) VALUES (?,?,?,?,?)").run(s.slug, slug, n, j, SUB_CHARTS[`${s.slug}/${slug}`] ?? "");
        }
      }
      for (const [i, z] of DEFAULT_ZONES.entries()) {
        await d.prepare("INSERT INTO shipping_zones (name,countries,first_kg_lkr,extra_kg_lkr,days,sort) VALUES (?,?,?,?,?,?)").run(z.name, z.countries, z.first, z.extra, z.days, i);
      }
      for (const [i, c] of DEFAULT_COLLECTIONS.entries()) {
        await d.prepare("INSERT INTO collections (slug,name,blurb,from_color,to_color,match_type,sort) VALUES (?,?,?,?,?,?,?)").run(c.slug, c.name, c.blurb, c.from, c.to, c.match, i);
      }
      for (const [i, f] of DEFAULT_FAQS.entries()) await d.prepare("INSERT INTO faqs (question,answer,sort) VALUES (?,?,?)").run(f.q, f.a, i);
      for (const [i, b] of DEFAULT_BANNERS.entries()) {
        await d.prepare("INSERT INTO banners (`position`,sort,eyebrow,title,body,cta_label,cta_href,from_color,to_color) VALUES (?,?,?,?,?,?,?,?,?)")
          .run(b.position, i, b.eyebrow, b.title, b.body, b.cta_label, b.cta_href, b.from, b.to);
      }
    },
  },
  {
    id: 3,
    name: "payments: purpose, received amount, verification trail, private proofs, idempotent orders, reconciliation",
    up: async (d) => {
      // Additive only: no existing order, payment or customer row is changed except new metadata columns being filled in.
      await d.exec(`ALTER TABLE payments
        ADD COLUMN purpose VARCHAR(12) NOT NULL DEFAULT 'full',
        ADD COLUMN received_amount INT NULL,
        ADD COLUMN verified_at DATETIME NULL,
        ADD COLUMN verification_source VARCHAR(24) NOT NULL DEFAULT '',
        ADD COLUMN proof_file VARCHAR(80) NULL`);
      await d.exec("ALTER TABLE payment_events ADD COLUMN payment_id INT NULL, ADD KEY pe_payment (payment_id)");
      await d.exec(`ALTER TABLE orders
        ADD COLUMN idempotency_key VARCHAR(64) NULL,
        ADD COLUMN balance_method VARCHAR(20) NOT NULL DEFAULT '',
        ADD UNIQUE KEY orders_idem (idempotency_key)`);
      await d.exec(`CREATE TABLE reconciliation_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_id INT NULL,
        kind VARCHAR(20) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        detail VARCHAR(300) NOT NULL DEFAULT '',
        status VARCHAR(12) NOT NULL DEFAULT 'open',
        resolution VARCHAR(20) NOT NULL DEFAULT '',
        resolution_note VARCHAR(300) NOT NULL DEFAULT '',
        refund_ref VARCHAR(100) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME NULL,
        resolved_by VARCHAR(60) NULL,
        KEY recon_status (status),
        KEY recon_order (order_id),
        CONSTRAINT chk_recon_status CHECK (status IN ('open','resolved')),
        CONSTRAINT fk_recon_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`);
      // Existing successful payments: record how they were verified (metadata only, amounts are never touched).
      await d.exec(`UPDATE payments SET received_amount = amount, verified_at = updated_at,
        verification_source = CASE provider WHEN 'payhere' THEN 'notify' WHEN 'bank' THEN 'staff' WHEN 'cash' THEN 'staff' ELSE 'system' END
        WHERE status = 'success' AND received_amount IS NULL`);
      for (const [k, v] of [["deposit_percent", "50"], ["balance_methods", "cash_pickup,cash_delivery,bank,online"], ["balance_note", "The balance is due before your order is handed over or delivered."]]) {
        await d.prepare("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE `key` = `key`").run(k, v);
      }
    },
  },
  {
    id: 4,
    name: "atomic rate-limit counters",
    up: async (d) => {
      await d.exec("CREATE TABLE IF NOT EXISTS rate_limits (k VARCHAR(120) NOT NULL PRIMARY KEY, n INT NOT NULL, reset_at BIGINT NOT NULL, KEY rl_reset (reset_at))");
    },
  },
  {
    id: 5,
    name: "competitions (league / team navigation) and products.competition_slug",
    up: async (d) => {
      // Additive only. No product is assigned to a competition here: existing rows keep competition_slug = ''.
      await d.exec(`CREATE TABLE IF NOT EXISTS competitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sport_slug VARCHAR(40) NOT NULL,
        slug VARCHAR(40) NOT NULL,
        name VARCHAR(80) NOT NULL,
        logo_url VARCHAR(500) NOT NULL DEFAULT '',
        sort INT NOT NULL DEFAULT 0,
        active TINYINT NOT NULL DEFAULT 1,
        UNIQUE KEY comp_unique (sport_slug, slug),
        CONSTRAINT fk_comp_sport FOREIGN KEY (sport_slug) REFERENCES sports(slug) ON DELETE CASCADE ON UPDATE CASCADE
      )`);
      const has = (await d.prepare("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'competition_slug'").get()) as { n: number };
      if (!Number(has.n)) await d.exec("ALTER TABLE products ADD COLUMN competition_slug VARCHAR(40) NOT NULL DEFAULT '', ADD KEY products_comp (sport_slug, competition_slug)");
      for (const [sport, names] of Object.entries(DEFAULT_COMPETITIONS)) {
        if (!(await d.prepare("SELECT 1 FROM sports WHERE slug = ?").get(sport))) continue;
        for (const [i, n] of names.entries()) {
          await d.prepare("INSERT IGNORE INTO competitions (sport_slug, slug, name, sort) VALUES (?,?,?,?)").run(sport, slugify(n), n, i);
        }
      }
    },
  },
  {
    id: 6,
    name: "voucher codes, gift cards (store_credits expiry/metadata, gift_orders), orders.voucher_code/discount/kind",
    up: async (d) => {
      // Additive only. Existing orders get discount 0, no voucher, kind 'shop'. Existing store credits never expire.
      await d.exec(`CREATE TABLE IF NOT EXISTS vouchers (
        code VARCHAR(30) NOT NULL PRIMARY KEY,
        kind VARCHAR(8) NOT NULL,
        value INT NOT NULL,
        min_spend INT NOT NULL DEFAULT 0,
        max_discount INT NOT NULL DEFAULT 0,
        starts_at DATETIME NULL,
        expires_at DATETIME NULL,
        max_uses INT NOT NULL DEFAULT 0,
        per_email INT NOT NULL DEFAULT 1,
        used_count INT NOT NULL DEFAULT 0,
        active TINYINT NOT NULL DEFAULT 1,
        note VARCHAR(200) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_voucher_kind CHECK (kind IN ('percent','fixed')),
        CONSTRAINT chk_voucher_value CHECK (value > 0)
      )`);
      await d.exec(`CREATE TABLE IF NOT EXISTS voucher_uses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL,
        order_id INT NOT NULL,
        email VARCHAR(200) NOT NULL,
        amount INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY voucher_use_order (order_id),
        KEY voucher_use_code (code, email)
      )`);
      await d.exec(`CREATE TABLE IF NOT EXISTS gift_orders (
        order_id INT NOT NULL PRIMARY KEY,
        face_value INT NOT NULL,
        recipient_name VARCHAR(100) NOT NULL DEFAULT '',
        sender_name VARCHAR(100) NOT NULL DEFAULT '',
        message VARCHAR(300) NOT NULL DEFAULT '',
        code VARCHAR(20) NOT NULL DEFAULT '',
        CONSTRAINT fk_gift_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`);
      const col = async (t: string, c: string) =>
        Number(((await d.prepare("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?").get(t, c)) as { n: number }).n) > 0;
      if (!(await col("orders", "voucher_code"))) await d.exec("ALTER TABLE orders ADD COLUMN voucher_code VARCHAR(30) NOT NULL DEFAULT '', ADD COLUMN discount INT NOT NULL DEFAULT 0, ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'shop'");
      if (!(await col("store_credits", "kind"))) await d.exec("ALTER TABLE store_credits ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'credit', ADD COLUMN expires_at DATETIME NULL, ADD COLUMN purchase_order_id INT NULL");
      for (const [k, v] of [["giftcard_tiers", "5000:5,10000:8,25000:10"], ["giftcard_valid_months", "12"]]) {
        await d.prepare("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE `key` = `key`").run(k, v);
      }
    },
  },
  {
    id: 7,
    name: "subgroups (under subcategories) with brand lists, products.subgroup_slug/brand_slug, editable site texts",
    up: async (d) => {
      // Additive only. No product is assigned to a subgroup or brand here.
      await d.exec(`CREATE TABLE IF NOT EXISTS subgroups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sport_slug VARCHAR(40) NOT NULL,
        subcategory_slug VARCHAR(40) NOT NULL,
        slug VARCHAR(40) NOT NULL,
        name VARCHAR(80) NOT NULL,
        brands TEXT NOT NULL,
        sort INT NOT NULL DEFAULT 0,
        active TINYINT NOT NULL DEFAULT 1,
        UNIQUE KEY subgroup_unique (sport_slug, slug),
        KEY subgroup_sub (sport_slug, subcategory_slug),
        CONSTRAINT fk_subgroup_sport FOREIGN KEY (sport_slug) REFERENCES sports(slug) ON DELETE CASCADE ON UPDATE CASCADE
      )`);
      const col = async (t: string, c: string) =>
        Number(((await d.prepare("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?").get(t, c)) as { n: number }).n) > 0;
      if (!(await col("products", "subgroup_slug"))) await d.exec("ALTER TABLE products ADD COLUMN subgroup_slug VARCHAR(40) NOT NULL DEFAULT '', ADD COLUMN brand_slug VARCHAR(40) NOT NULL DEFAULT '', ADD KEY products_group (sport_slug, subgroup_slug)");
      await d.exec(`CREATE TABLE IF NOT EXISTS site_texts (
        k VARCHAR(60) NOT NULL PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);
    },
  },
];

export async function runMigrations(d: Handle) {
  await d.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id INT PRIMARY KEY, name VARCHAR(120) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const done = new Set(((await d.prepare("SELECT id FROM schema_migrations").all()) as { id: number }[]).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await d.exec("START TRANSACTION");
    try {
      await m.up(d);
      await d.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)").run(m.id, m.name);
      await d.exec("COMMIT");
    } catch (e) {
      await d.exec("ROLLBACK").catch(() => {});
      throw e;
    }
    console.log(`[db] applied migration ${m.id}: ${m.name}`);
  }
  // Demo products are opt-in and only ever added to a catalogue that is still empty.
  if (process.env.SEED_DEMO_DATA === "true") {
    const n = (await d.prepare("SELECT COUNT(*) AS n FROM products").get()) as { n: number };
    if (n.n === 0) await seedDemo(d);
  }
}
