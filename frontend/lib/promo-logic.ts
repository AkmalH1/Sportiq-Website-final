/** Pure rules for voucher discounts and gift-card pricing. No database, no server-only imports, so they can be unit-tested. */

export type VoucherKind = "percent" | "fixed";
export type VoucherRule = { kind: VoucherKind; value: number; minSpend: number; maxDiscount: number };

/** Codes are typed by people: ignore case and stray spaces. */
export const normalizeCode = (s: unknown): string => String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
export const VOUCHER_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

/** Discount in whole LKR for a merchandise subtotal. Never negative, never more than the subtotal. 0 when the minimum spend is not met. */
export function voucherDiscount(rule: VoucherRule, subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (subtotal < rule.minSpend) return 0;
  let d = rule.kind === "percent" ? Math.floor((subtotal * rule.value) / 100) : rule.value;
  if (rule.kind === "percent" && rule.maxDiscount > 0) d = Math.min(d, rule.maxDiscount);
  return Math.max(0, Math.min(Math.floor(d), subtotal));
}

/** Splits a discount between ready-stock and pre-order items in proportion to their value, so the pre-order deposit stays consistent. */
export function splitDiscount(discount: number, readyTotal: number, preTotal: number): { ready: number; pre: number } {
  const all = readyTotal + preTotal;
  if (discount <= 0 || all <= 0) return { ready: 0, pre: 0 };
  const pre = Math.min(preTotal, Math.round((discount * preTotal) / all));
  return { ready: Math.min(readyTotal, discount - pre), pre };
}

export type GiftTier = { face: number; percent: number };
export const GIFT_MIN = 2000;
export const GIFT_MAX = 100000;

/** "5000:5,10000:8,25000:10" means: a 5,000 card is 5% off, 10,000 is 8% off, 25,000 is 10% off. Invalid pieces are ignored. */
export function parseTiers(s: string): GiftTier[] {
  const out: GiftTier[] = [];
  for (const part of String(s ?? "").split(",")) {
    const m = /^\s*(\d{3,6})\s*:\s*(\d{1,2})\s*$/.exec(part);
    if (!m) continue;
    const face = Number(m[1]);
    const percent = Number(m[2]);
    if (face >= GIFT_MIN && face <= GIFT_MAX && percent >= 0 && percent <= 50 && !out.some((t) => t.face === face)) out.push({ face, percent });
  }
  return out.sort((a, b) => a.face - b.face);
}

/** What the buyer pays for a gift card worth `face`. The discount is the best tier whose card value is not above `face`. */
export function giftPrice(face: number, tiers: GiftTier[]): { face: number; percent: number; price: number; saving: number } | null {
  if (!Number.isInteger(face) || face < GIFT_MIN || face > GIFT_MAX) return null;
  let percent = 0;
  for (const t of tiers) if (t.face <= face) percent = t.percent;
  const price = Math.ceil((face * (100 - percent)) / 100);
  return { face, percent, price, saving: face - price };
}

export const GIFT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const GIFT_CODE_RE = /^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
