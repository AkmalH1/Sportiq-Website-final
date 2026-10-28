import "server-only";
import { audit, db, tx, type Handle } from "./db";
import { OrderError, setStage } from "./orders";
import { slugify } from "./categories";
import { setSettings } from "./settings";
import { toCountryCode } from "./countries";

/* ---------------- CSV helpers ---------------- */
import { toCsv } from "./csv";
export { csvEsc, toCsv } from "./csv";

/* ---------------- dealers / suppliers ---------------- */
export type Dealer = { id: number; name: string; country: string; whatsapp: string; notes: string; payable: number; paid: number; status: "Unpaid" | "Partial" | "Paid" | "None" };

export async function listDealers(): Promise<Dealer[]> {
  const rows = (await db().prepare(
    `SELECT d.id, d.name, d.country, d.whatsapp, d.notes, COALESCE(SUM(b.payable),0) AS payable, COALESCE(SUM(b.paid),0) AS paid
     FROM dealers d LEFT JOIN batches b ON b.dealer_id = d.id GROUP BY d.id, d.name, d.country, d.whatsapp, d.notes ORDER BY d.name`,
  ).all()) as (Omit<Dealer, "status"> & { created_at: string })[];
  return rows.map((r) => ({ ...r, status: r.payable === 0 ? "None" : r.paid >= r.payable ? "Paid" : r.paid > 0 ? "Partial" : "Unpaid" }));
}

export async function saveDealer(id: number, v: { name: string; country: string; whatsapp: string; notes: string }, actor: string) {
  if (v.name.trim().length < 2) throw new OrderError("Enter the supplier name.");
  const wa = v.whatsapp.replace(/[^\d+]/g, "").slice(0, 20);
  if (id) await db().prepare("UPDATE dealers SET name=?, country=?, whatsapp=?, notes=? WHERE id=?").run(v.name.trim(), v.country.trim(), wa, v.notes.trim(), id);
  else await db().prepare("INSERT INTO dealers (name, country, whatsapp, notes) VALUES (?,?,?,?)").run(v.name.trim(), v.country.trim(), wa, v.notes.trim());
  await audit(actor, id ? "dealer.update" : "dealer.create", v.name);
}

export async function deleteDealer(id: number, actor: string) {
  await db().prepare("DELETE FROM dealers WHERE id = ?").run(id);
  await audit(actor, "dealer.delete", String(id));
}

/* ---------------- batches (pre-order management) ---------------- */
export const BATCH_STAGES = ["Confirmed", "Supplier Paid", "Production", "Shipping", "Arrived in Sri Lanka"] as const;

export type Batch = {
  id: number; name: string; dealer_id: number | null; dealer_name: string | null; stage: string; eta: string;
  payable: number; paid: number; notes: string; created_at: string; orders: number; units: number; order_value: number;
};

export async function listBatches(): Promise<Batch[]> {
  return (await db().prepare(
    `SELECT b.*, d.name AS dealer_name,
       (SELECT COUNT(*) FROM orders o WHERE o.batch_id = b.id AND o.stage != 'Cancelled') AS orders,
       (SELECT COALESCE(SUM(i.qty),0) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.batch_id = b.id AND o.stage != 'Cancelled' AND i.source='preorder') AS units,
       (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.batch_id = b.id AND o.stage != 'Cancelled') AS order_value
     FROM batches b LEFT JOIN dealers d ON d.id = b.dealer_id ORDER BY b.id DESC`,
  ).all()) as Batch[];
}

export const getBatch = async (id: number) => (await listBatches()).find((b) => b.id === id) ?? null;

export async function saveBatch(id: number, v: { name: string; dealerId: number; eta: string; payable: number; notes: string }, actor: string): Promise<number> {
  if (v.name.trim().length < 2) throw new OrderError("Give the batch a name.");
  if (!Number.isInteger(v.payable) || v.payable < 0) throw new OrderError("Amount payable must be a whole number.");
  const dealer = v.dealerId || null;
  if (id) {
    await db().prepare("UPDATE batches SET name=?, dealer_id=?, eta=?, payable=?, notes=? WHERE id=?").run(v.name.trim(), dealer, v.eta.trim(), v.payable, v.notes.trim(), id);
  } else {
    id = (await db().prepare("INSERT INTO batches (name, dealer_id, eta, payable, notes) VALUES (?,?,?,?,?)").run(v.name.trim(), dealer, v.eta.trim(), v.payable, v.notes.trim())).lastInsertRowid;
  }
  await audit(actor, "batch.save", `#${id} ${v.name}`);
  return id;
}

export async function recordSupplierPayment(batchId: number, amount: number, actor: string) {
  const b = await getBatch(batchId);
  if (!b) throw new OrderError("Batch not found.");
  if (!Number.isInteger(amount) || amount < 1) throw new OrderError("Enter the amount as a whole number.");
  await db().prepare("UPDATE batches SET paid = paid + ? WHERE id = ?").run(amount, batchId);
  await audit(actor, "batch.supplier_payment", `#${batchId} LKR ${amount}`);
}

/** Put pre-orders into a batch (or take them out with batchId 0). */
export async function assignOrders(refs: string[], batchId: number, actor: string): Promise<number> {
  if (batchId && !(await getBatch(batchId))) throw new OrderError("Batch not found.");
  let n = 0;
  await tx(async (d) => {
    n = 0;
    for (const ref of refs) {
      const r = await d.prepare("UPDATE orders SET batch_id = ? WHERE reference = ? AND has_preorder = 1 AND stage != 'Cancelled'").run(batchId || null, ref);
      n += r.changes;
    }
  });
  await audit(actor, "batch.assign", `${n} orders -> ${batchId || "none"}`);
  return n;
}

/** Move a whole batch to a stage. Each order still has to satisfy the payment rules; those that do not are skipped and counted. */
export async function advanceBatch(batchId: number, stage: string, note: string, actor: string): Promise<{ moved: number; skipped: string[] }> {
  const b = await getBatch(batchId);
  if (!b) throw new OrderError("Batch not found.");
  if (!(BATCH_STAGES as readonly string[]).includes(stage)) throw new OrderError("Pick a stage for the batch.");
  const refs = (await db().prepare("SELECT reference FROM orders WHERE batch_id = ? AND stage != 'Cancelled'").all(batchId)) as { reference: string }[];
  const order = (s: string) => BATCH_STAGES.indexOf(s as never);
  let moved = 0;
  const skipped: string[] = [];
  for (const { reference } of refs) {
    const cur = ((await db().prepare("SELECT stage FROM orders WHERE reference = ?").get(reference)) as { stage: string }).stage;
    if (order(cur) > order(stage)) continue; // already further along (for example delivery stages)
    if (cur === stage) { moved++; continue; }
    try {
      await setStage(reference, stage, note || `Batch: ${b.name}`, actor);
      moved++;
    } catch {
      skipped.push(reference);
    }
  }
  await db().prepare("UPDATE batches SET stage = ? WHERE id = ?").run(stage, batchId);
  await audit(actor, "batch.advance", `#${batchId} -> ${stage} (${moved} moved, ${skipped.length} skipped)`);
  return { moved, skipped };
}

/* ---------------- expenses ---------------- */
export type Expense = { id: number; category: string; amount: number; spent_on: string; batch_id: number | null; description: string };
export const EXPENSE_CATEGORIES = ["Shipping and freight", "Packaging", "Marketing", "Store rent", "Salaries", "Customs and tax", "Other"];

export const listExpenses = async () => (await db().prepare("SELECT * FROM expenses ORDER BY spent_on DESC, id DESC LIMIT 500").all()) as Expense[];

export async function addExpense(v: { category: string; amount: number; date: string; batchId: number; description: string }, actor: string) {
  if (!v.category.trim()) throw new OrderError("Choose a category.");
  if (!Number.isInteger(v.amount) || v.amount < 1) throw new OrderError("Enter the amount as a whole number.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) throw new OrderError("Enter a valid date.");
  await db().prepare("INSERT INTO expenses (category, amount, spent_on, batch_id, description) VALUES (?,?,?,?,?)").run(v.category.trim(), v.amount, v.date, v.batchId || null, v.description.trim().slice(0, 200));
  await audit(actor, "expense.add", `${v.category} LKR ${v.amount}`);
}

export async function deleteExpense(id: number, actor: string) {
  await db().prepare("DELETE FROM expenses WHERE id = ?").run(id);
  await audit(actor, "expense.delete", String(id));
}

/* ---------------- dashboard / reports ---------------- */
export async function dashboard() {
  const one = async (sql: string) => ((await db().prepare(sql).get()) as { n: number }).n;
  const stages = (await db().prepare("SELECT stage, COUNT(*) AS n FROM orders GROUP BY stage").all()) as { stage: string; n: number }[];
  return {
    orders: await one("SELECT COUNT(*) AS n FROM orders WHERE stage != 'Cancelled'"),
    received: await one("SELECT COALESCE(SUM(paid_amount),0) AS n FROM orders WHERE stage != 'Cancelled'"),
    owing: await one("SELECT COALESCE(SUM(total - paid_amount),0) AS n FROM orders WHERE stage NOT IN ('Cancelled') AND paid_amount >= due_now"),
    supplierPaid: await one("SELECT COALESCE(SUM(paid),0) AS n FROM batches"),
    supplierDue: await one("SELECT COALESCE(SUM(payable - paid),0) AS n FROM batches WHERE payable > paid"),
    expenses: await one("SELECT COALESCE(SUM(amount),0) AS n FROM expenses"),
    stages: Object.fromEntries(stages.map((s) => [s.stage, s.n])) as Record<string, number>,
    unbatched: await one("SELECT COUNT(*) AS n FROM orders WHERE has_preorder = 1 AND batch_id IS NULL AND stage NOT IN ('Cancelled','Awaiting payment','Delivered','Collected')"),
  };
}

export type Customer = { email: string; name: string; phone: string; country: string; orders: number; spent: number; last: string };
export async function listCustomers(): Promise<Customer[]> {
  return (await db().prepare(
    `SELECT email, MAX(customer_name) AS name, MAX(phone) AS phone, MAX(country) AS country, COUNT(*) AS orders,
       COALESCE(SUM(CASE WHEN stage != 'Cancelled' THEN paid_amount ELSE 0 END),0) AS spent, MAX(created_at) AS last
     FROM orders GROUP BY email ORDER BY last DESC`,
  ).all()) as Customer[];
}

export const listPayments = async () => (await db().prepare(
  `SELECT p.id, p.created_at, o.reference, o.customer_name, p.provider, p.amount, p.status, p.provider_ref, p.note, p.purpose, p.verified_by, p.verification_source
   FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.id DESC LIMIT 500`,
).all()) as { id: number; created_at: string; reference: string; customer_name: string; provider: string; amount: number; status: string; provider_ref: string | null; note: string; purpose: string; verified_by: string | null; verification_source: string }[];

export const listActivity = async () => (await db().prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300").all()) as { id: number; actor: string; action: string; detail: string; created_at: string }[];

export async function exportCsv(kind: string): Promise<string | null> {
  if (kind === "orders") {
    const rows = (await db().prepare("SELECT * FROM orders ORDER BY id DESC").all()) as Record<string, unknown>[];
    return toCsv([
      ["reference", "date", "name", "email", "phone", "country", "delivery", "total", "paid", "payment_status", "plan", "stage", "preorder", "batch"],
      ...rows.map((o) => [o.reference, o.created_at, o.customer_name, o.email, o.phone, o.country, o.delivery_method, o.total, o.paid_amount, o.payment_status, o.payment_plan, o.stage, o.has_preorder ? "yes" : "no", o.batch_id ?? ""]),
    ]);
  }
  if (kind === "customers") {
    return toCsv([["email", "name", "phone", "country", "orders", "paid_total", "last_order"], ...(await listCustomers()).map((c) => [c.email, c.name, c.phone, c.country, c.orders, c.spent, c.last])]);
  }
  if (kind === "payments") {
    return toCsv([["date", "reference", "customer", "method", "amount", "status", "provider_ref", "note"], ...(await listPayments()).map((p) => [p.created_at, p.reference, p.customer_name, p.provider, p.amount, p.status, p.provider_ref ?? "", p.note])]);
  }
  if (kind === "expenses") {
    return toCsv([["date", "category", "amount", "batch", "description"], ...(await listExpenses()).map((e) => [e.spent_on, e.category, e.amount, e.batch_id ?? "", e.description])]);
  }
  return null;
}

/* ---------------- WhatsApp message templates ---------------- */
export function stageMessage(o: { customer_name: string; reference: string; stage: string; delivery_method: string }, siteUrl: string): string {
  const first = o.customer_name.split(" ")[0];
  const track = `${siteUrl}/track-order`;
  const map: Record<string, string> = {
    Confirmed: "your order is confirmed. Thank you!",
    "Supplier Paid": "we have paid the supplier for your pre-order.",
    Production: "your pre-order is now in production.",
    Shipping: "your pre-order is on its way to Sri Lanka.",
    "Arrived in Sri Lanka": "your pre-order has arrived in Sri Lanka.",
    "Out for Delivery": "your order is out for delivery. Please keep your phone on, and have any cash balance ready.",
    "Ready for Pickup": "your order is ready for pickup at our store.",
    Posted: "your order has been posted.",
    Delivered: "your order is marked delivered. Thank you for shopping with SPORTIQ!",
    Collected: "thank you for collecting your order from SPORTIQ!",
  };
  return `Hi ${first}, ${map[o.stage] ?? `your order is now: ${o.stage}.`} Order ${o.reference}. Track it any time: ${track}`;
}

/* ---------------- categories ---------------- */
export async function saveSport(slug: string, v: { name: string; tagline: string; accent: string; sort: number; active: boolean; chart: string }, actor: string) {
  if (v.name.trim().length < 2) throw new OrderError("Enter a name.");
  const accent = /^#[0-9a-fA-F]{6}$/.test(v.accent) ? v.accent : "#111111";
  await db().prepare("UPDATE sports SET name=?, tagline=?, accent=?, sort=?, active=?, size_chart=? WHERE slug=?").run(v.name.trim(), v.tagline.trim(), accent, v.sort, v.active ? 1 : 0, v.chart.slice(0, 3000), slug);
  await audit(actor, "category.update", slug);
}

export async function addSport(name: string, actor: string): Promise<string> {
  const slug = slugify(name);
  if (!slug) throw new OrderError("Enter a name.");
  if (await db().prepare("SELECT 1 FROM sports WHERE slug = ?").get(slug)) throw new OrderError("That category already exists.");
  const next = ((await db().prepare("SELECT COALESCE(MAX(sort),0)+1 AS n FROM sports").get()) as { n: number }).n;
  await db().prepare("INSERT INTO sports (slug, name, sort) VALUES (?,?,?)").run(slug, name.trim(), next);
  await audit(actor, "category.add", slug);
  return slug;
}

export async function deleteSport(slug: string, actor: string) {
  const n = ((await db().prepare("SELECT COUNT(*) AS n FROM products WHERE sport_slug = ?").get(slug)) as { n: number }).n;
  if (n > 0) throw new OrderError(`${n} product(s) use this category. Move them first, or hide the category instead.`);
  await db().prepare("DELETE FROM sports WHERE slug = ?").run(slug);
  await audit(actor, "category.delete", slug);
}

export async function saveSub(id: number, v: { name: string; sort: number; active: boolean; chart: string }, actor: string) {
  if (v.name.trim().length < 1) throw new OrderError("Enter a name.");
  await db().prepare("UPDATE subcategories SET name=?, sort=?, active=?, size_chart=? WHERE id=?").run(v.name.trim(), v.sort, v.active ? 1 : 0, v.chart.slice(0, 3000), id);
  await audit(actor, "subcategory.update", String(id));
}

export async function addSub(sportSlug: string, name: string, actor: string) {
  const slug = slugify(name);
  if (!slug) throw new OrderError("Enter a name.");
  if (await db().prepare("SELECT 1 FROM subcategories WHERE sport_slug = ? AND slug = ?").get(sportSlug, slug)) throw new OrderError("That subcategory already exists.");
  const next = ((await db().prepare("SELECT COALESCE(MAX(sort),0)+1 AS n FROM subcategories WHERE sport_slug = ?").get(sportSlug)) as { n: number }).n;
  await db().prepare("INSERT INTO subcategories (sport_slug, slug, name, sort) VALUES (?,?,?,?)").run(sportSlug, slug, name.trim(), next);
  await audit(actor, "subcategory.add", `${sportSlug}/${slug}`);
}

export async function deleteSub(id: number, actor: string) {
  const s = (await db().prepare("SELECT sport_slug, slug FROM subcategories WHERE id = ?").get(id)) as { sport_slug: string; slug: string } | undefined;
  if (!s) return;
  const n = ((await db().prepare("SELECT COUNT(*) AS n FROM products WHERE sport_slug = ? AND subcategory_slug = ?").get(s.sport_slug, s.slug)) as { n: number }).n;
  if (n > 0) throw new OrderError(`${n} product(s) use this subcategory. Move them first, or hide it instead.`);
  const g = ((await db().prepare("SELECT COUNT(*) AS n FROM subgroups WHERE sport_slug = ? AND subcategory_slug = ?").get(s.sport_slug, s.slug)) as { n: number }).n;
  if (g > 0) throw new OrderError(`This subcategory has ${g} subgroup(s). Delete or move them first, or hide it instead.`);
  await db().prepare("DELETE FROM subcategories WHERE id = ?").run(id);
  await audit(actor, "subcategory.delete", String(id));
}

/* ---------------- shipping zones ---------------- */
export async function saveZone(id: number, v: { name: string; countries: string; first: number; extra: number; days: string }, actor: string) {
  if (v.name.trim().length < 2) throw new OrderError("Enter a zone name.");
  if (![v.first, v.extra].every((n) => Number.isInteger(n) && n >= 0)) throw new OrderError("Prices must be whole numbers.");
  const parts = v.countries.split(/[,\n;]+/).map((c) => c.trim()).filter(Boolean);
  const codes: string[] = [];
  for (const p of parts) {
    if (p === "*") { codes.push("*"); continue; }
    const c = toCountryCode(p);
    if (!c) throw new OrderError(`"${p}" is not a country we recognise. Use a name or a 2-letter code.`);
    if (c === "LK") throw new OrderError("Sri Lanka uses the local delivery fee, not a postage zone.");
    codes.push(c);
  }
  const csv = [...new Set(codes)].join(",");
  if (id) await db().prepare("UPDATE shipping_zones SET name=?, countries=?, first_kg_lkr=?, extra_kg_lkr=?, days=? WHERE id=?").run(v.name.trim(), csv, v.first, v.extra, v.days.trim(), id);
  else {
    const next = ((await db().prepare("SELECT COALESCE(MAX(sort),0)+1 AS n FROM shipping_zones").get()) as { n: number }).n;
    await db().prepare("INSERT INTO shipping_zones (name, countries, first_kg_lkr, extra_kg_lkr, days, sort) VALUES (?,?,?,?,?,?)").run(v.name.trim(), csv, v.first, v.extra, v.days.trim(), next);
  }
  await audit(actor, "shipping.zone", v.name);
}

export async function deleteZone(id: number, actor: string) {
  await db().prepare("DELETE FROM shipping_zones WHERE id = ?").run(id);
  await audit(actor, "shipping.zone_delete", String(id));
}

export async function saveSiteSettings(values: Record<string, string>, actor: string) {
  await setSettings(values);
  await audit(actor, "settings.save", Object.keys(values).join(","));
}

/* ---------------- EMS (Sri Lanka Post) rates ---------------- */
export async function saveEms(d: Handle, v: { country: string; p250: number; p500: number; p1000: number; step500: number; maxKg: number; note: string }, actor: string) {
  const code = toCountryCode(v.country);
  if (!code || code === "LK") throw new OrderError(`"${v.country}" is not a country we can post to.`);
  if (![v.p250, v.p500, v.p1000, v.step500].every((n) => Number.isInteger(n) && n >= 0) || v.p250 < 1 || v.p500 < v.p250 || v.p1000 < v.p500) {
    throw new OrderError("Prices must be whole numbers and go up with weight (250 g, then 500 g, then 1 kg).");
  }
  const maxKg = v.maxKg >= 1 && v.maxKg <= 70 ? v.maxKg : 20;
  await d.prepare(
    `INSERT INTO ems_rates (country, p250, p500, p1000, step500, max_kg, note) VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE p250=VALUES(p250), p500=VALUES(p500), p1000=VALUES(p1000), step500=VALUES(step500), max_kg=VALUES(max_kg), note=VALUES(note)`,
  ).run(code, v.p250, v.p500, v.p1000, v.step500, maxKg, v.note.slice(0, 120));
  await audit(actor, "ems.save", code, d);
}

export const saveEmsRate = (v: Parameters<typeof saveEms>[1], actor: string) => tx((d) => saveEms(d, v, actor));

/** Paste lines: country,p250,p500,p1000,step500[,max_kg]. All lines must be valid or nothing is saved. */
export async function importEms(text: string, actor: string): Promise<number> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^country\b/i.test(l));
  if (lines.length === 0) throw new OrderError("Paste at least one line.");
  const rows = lines.map((l, i) => {
    const c = l.split(/[,\t;]/).map((x) => x.trim());
    if (c.length < 5) throw new OrderError(`Line ${i + 1}: expected country, 250 g, 500 g, 1 kg, each extra 500 g.`);
    return { country: c[0], p250: Math.round(Number(c[1])), p500: Math.round(Number(c[2])), p1000: Math.round(Number(c[3])), step500: Math.round(Number(c[4])), maxKg: Math.round(Number(c[5] || 20)), note: "" };
  });
  await tx(async (d) => { for (const r of rows) await saveEms(d, r, actor); }); // all or nothing
  return rows.length;
}

export async function deleteEms(country: string, actor: string) {
  await db().prepare("DELETE FROM ems_rates WHERE country = ?").run(country);
  await audit(actor, "ems.delete", country);
}
