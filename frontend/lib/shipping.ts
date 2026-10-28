import "server-only";
import { db } from "./db";
import { getSettings, intSetting } from "./settings";

export type DeliveryMethod = "delivery" | "pickup" | "international";
export type Zone = { id: number; name: string; countries: string[]; firstKg: number; extraKg: number; days: string };

/** Packaging weight added to every parcel, in grams. */
export const PACKAGING_G = 150;

export async function listZones(): Promise<Zone[]> {
  const rows = (await db().prepare("SELECT * FROM shipping_zones ORDER BY sort, id").all()) as {
    id: number; name: string; countries: string; first_kg_lkr: number; extra_kg_lkr: number; days: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    countries: r.countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
    firstKg: r.first_kg_lkr,
    extraKg: r.extra_kg_lkr,
    days: r.days,
  }));
}

export async function zoneFor(country: string, zones?: Zone[]): Promise<Zone | null> {
  zones ??= await listZones();
  const c = country.toUpperCase();
  return zones.find((z) => z.countries.includes(c)) ?? zones.find((z) => z.countries.includes("*")) ?? null;
}

export type EmsRate = { country: string; p250: number; p500: number; p1000: number; step500: number; max_kg: number; note: string };

export const listEms = async () => (await db().prepare("SELECT * FROM ems_rates ORDER BY country").all()) as EmsRate[];

/** EMS price from the Sri Lanka Post table: bands up to 250 g, 500 g and 1 kg, then a price for each further 500 g. */
export function emsFee(r: EmsRate, grams: number, markupPct: number): number {
  const w = Math.max(1, grams);
  const base = w <= 250 ? r.p250 : w <= 500 ? r.p500 : w <= 1000 ? r.p1000 : r.p1000 + Math.ceil((w - 1000) / 500) * r.step500;
  return Math.ceil((base * (1 + markupPct / 100)) / 10) * 10;
}

export type PostageResult = { fee: number; zone: { name: string; days: string }; kg: number; source: "ems" | "zone" };

/** International postage: the country's EMS rates if staff have entered them, otherwise the zone table. */
export async function postage(country: string, grams: number): Promise<PostageResult | null> {
  const total = grams + PACKAGING_G;
  const settings = await getSettings();
  // Staff can switch EMS off (Admin > EMS rates). Then every country is priced from the zone table instead.
  const emsOn = settings.ems_enabled !== "no";
  const ems = emsOn ? ((await db().prepare("SELECT * FROM ems_rates WHERE country = ?").get(country.toUpperCase())) as EmsRate | undefined) : undefined;
  if (ems && ems.p250 > 0) {
    if (total > ems.max_kg * 1000) throw new Error(`This order is too heavy for one parcel to that country (limit ${ems.max_kg} kg). Please message us on WhatsApp.`);
    const markup = Number(settings.ems_markup_pct) || 0;
    return { fee: emsFee(ems, total, markup), zone: { name: "EMS, Sri Lanka Post", days: "5 to 12 working days" }, kg: Math.ceil(total / 1000), source: "ems" };
  }
  const zone = await zoneFor(country);
  if (!zone) return null;
  const kg = Math.max(1, Math.ceil(total / 1000));
  return { fee: zone.firstKg + (kg - 1) * zone.extraKg, zone, kg, source: "zone" };
}

export type DeliveryQuote = { method: DeliveryMethod; fee: number; label: string; days: string };

export async function deliveryFor(country: string, method: string, grams: number): Promise<DeliveryQuote> {
  const s = await getSettings();
  if (country === "LK") {
    if (method === "pickup") return { method: "pickup", fee: 0, label: "Store pickup", days: "Collect from our store" };
    return { method: "delivery", fee: intSetting(s, "local_delivery_fee", 500), label: "Delivery in Sri Lanka", days: "2 to 4 working days" };
  }
  const p = await postage(country, grams);
  if (!p) throw new Error("We cannot quote postage to that country yet. Please message us on WhatsApp.");
  return { method: "international", fee: p.fee, label: p.source === "ems" ? "International postage (EMS)" : `International postage (${p.zone.name})`, days: p.zone.days };
}

/** Stage list for an order. Pre-orders include the supplier steps; the last steps depend on how it reaches the customer. */
export function stagesFor(hasPreorder: boolean, method: string): string[] {
  const tail =
    method === "pickup" ? ["Ready for Pickup", "Collected"] : method === "international" ? ["Posted", "Delivered"] : ["Out for Delivery", "Delivered"];
  return hasPreorder ? ["Confirmed", "Supplier Paid", "Production", "Shipping", "Arrived in Sri Lanka", ...tail] : ["Confirmed", ...tail];
}

export const FINAL_STAGES = ["Delivered", "Collected"];
