import "server-only";
import { audit, db, tx, type Handle } from "./db";
import { VOUCHER_CODE_RE, normalizeCode, voucherDiscount, type VoucherKind } from "./promo-logic";

export type Voucher = {
  code: string; kind: VoucherKind; value: number; minSpend: number; maxDiscount: number; startsAt: string | null; expiresAt: string | null;
  maxUses: number; perEmail: number; usedCount: number; active: boolean; note: string; createdAt: string;
};
type Row = {
  code: string; kind: VoucherKind; value: number; min_spend: number; max_discount: number; starts_at: string | null; expires_at: string | null;
  max_uses: number; per_email: number; used_count: number; active: number; note: string; created_at: string; not_started?: number; expired?: number;
};
const toVoucher = (r: Row): Voucher => ({
  code: r.code, kind: r.kind, value: r.value, minSpend: r.min_spend, maxDiscount: r.max_discount, startsAt: r.starts_at, expiresAt: r.expires_at,
  maxUses: r.max_uses, perEmail: r.per_email, usedCount: r.used_count, active: !!r.active, note: r.note, createdAt: r.created_at,
});
const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK")}`;

export type VoucherCheck = { ok: true; code: string; discount: number } | { ok: false; error: string };

/**
 * Validates a voucher against a merchandise subtotal. Every error message starts with "That voucher" so the checkout can show it next
 * to the voucher box without blocking the order. With lock=true (inside the order transaction) the voucher row is locked, so two
 * simultaneous orders cannot both take the last use.
 */
export async function checkVoucher(d: Handle, rawCode: string, subtotal: number, opts: { email?: string; lock?: boolean } = {}): Promise<VoucherCheck> {
  const code = normalizeCode(rawCode);
  if (!VOUCHER_CODE_RE.test(code)) return { ok: false, error: "That voucher code is not valid." };
  const r = (await d
    .prepare(
      `SELECT *, (starts_at IS NOT NULL AND starts_at > UTC_TIMESTAMP()) AS not_started, (expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()) AS expired
       FROM vouchers WHERE code = ?${opts.lock ? " FOR UPDATE" : ""}`,
    )
    .get(code)) as Row | undefined;
  // One message for "does not exist" and "switched off", so codes cannot be probed.
  if (!r || !r.active) return { ok: false, error: "That voucher code is not valid." };
  if (Number(r.not_started)) return { ok: false, error: "That voucher is not active yet." };
  if (Number(r.expired)) return { ok: false, error: "That voucher has expired." };
  if (r.max_uses > 0 && r.used_count >= r.max_uses) return { ok: false, error: "That voucher has been fully used." };
  if (subtotal < r.min_spend) return { ok: false, error: `That voucher needs a minimum order of ${lkr(r.min_spend)} (before postage).` };
  if (opts.email && r.per_email > 0) {
    const n = ((await d.prepare("SELECT COUNT(*) AS n FROM voucher_uses WHERE code = ? AND email = ?").get(code, opts.email.toLowerCase())) as { n: number }).n;
    if (Number(n) >= r.per_email) return { ok: false, error: "That voucher has already been used with this email address." };
  }
  const discount = voucherDiscount({ kind: r.kind, value: r.value, minSpend: r.min_spend, maxDiscount: r.max_discount }, subtotal);
  if (discount <= 0) return { ok: false, error: "That voucher does not apply to this order." };
  return { ok: true, code, discount };
}

/** Counts the use inside the order transaction. False means the last use was taken a moment ago. */
export async function recordVoucherUse(d: Handle, code: string, orderId: number, email: string, amount: number): Promise<boolean> {
  const upd = await d.prepare("UPDATE vouchers SET used_count = used_count + 1 WHERE code = ? AND active = 1 AND (max_uses = 0 OR used_count < max_uses)").run(code);
  if (upd.changes !== 1) return false;
  await d.prepare("INSERT INTO voucher_uses (code, order_id, email, amount) VALUES (?,?,?,?)").run(code, orderId, email.toLowerCase(), amount);
  return true;
}

/** An unpaid order was cancelled: the voucher use goes back. */
export async function releaseVoucherUse(d: Handle, orderId: number) {
  const u = (await d.prepare("SELECT code FROM voucher_uses WHERE order_id = ?").get(orderId)) as { code: string } | undefined;
  if (!u) return;
  await d.prepare("DELETE FROM voucher_uses WHERE order_id = ?").run(orderId);
  await d.prepare("UPDATE vouchers SET used_count = GREATEST(0, used_count - 1) WHERE code = ?").run(u.code);
}

/* ---------------- admin ---------------- */
export class VoucherAdminError extends Error {}

const utc = (iso: string) => new Date(iso).toISOString().slice(0, 19).replace("T", " ");
/** Admin enters dates in Sri Lanka time: a voucher starts at 00:00 on its first day and ends at 23:59:59 on its last day. */
const dayStart = (ymd: string) => utc(`${ymd}T00:00:00+05:30`);
const dayEnd = (ymd: string) => utc(`${ymd}T23:59:59+05:30`);

export async function createVoucher(v: { code: string; kind: string; value: number; minSpend: number; maxDiscount: number; from: string; to: string; maxUses: number; perEmail: number; note: string }, actor: string) {
  const code = normalizeCode(v.code);
  if (!VOUCHER_CODE_RE.test(code)) throw new VoucherAdminError("Code: 3 to 30 letters, numbers or hyphens, for example WELCOME10.");
  if (v.kind !== "percent" && v.kind !== "fixed") throw new VoucherAdminError("Choose percent or fixed amount.");
  const whole = (n: number) => Number.isInteger(n) && n >= 0;
  if (!whole(v.value) || v.value < 1) throw new VoucherAdminError("Enter the discount as a whole number.");
  if (v.kind === "percent" && v.value > 90) throw new VoucherAdminError("A percentage voucher can be at most 90%.");
  if (v.kind === "fixed" && v.value > 1_000_000) throw new VoucherAdminError("That amount is too large.");
  if (![v.minSpend, v.maxDiscount, v.maxUses, v.perEmail].every(whole)) throw new VoucherAdminError("Minimum spend, cap and limits must be whole numbers (0 means none).");
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (v.from && !ymd.test(v.from)) throw new VoucherAdminError("Start date is not valid.");
  if (v.to && !ymd.test(v.to)) throw new VoucherAdminError("End date is not valid.");
  if (v.from && v.to && v.to < v.from) throw new VoucherAdminError("The end date is before the start date.");
  try {
    await db().prepare("INSERT INTO vouchers (code, kind, value, min_spend, max_discount, starts_at, expires_at, max_uses, per_email, note) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(code, v.kind, v.value, v.minSpend, v.kind === "percent" ? v.maxDiscount : 0, v.from ? dayStart(v.from) : null, v.to ? dayEnd(v.to) : null, v.maxUses, v.perEmail, v.note.slice(0, 200));
  } catch (e) {
    if ((e as { errno?: number }).errno === 1062) throw new VoucherAdminError("That code already exists.");
    throw e;
  }
  await audit(actor, "voucher.create", code);
}

export async function setVoucherActive(code: string, active: boolean, actor: string) {
  await db().prepare("UPDATE vouchers SET active = ? WHERE code = ?").run(active ? 1 : 0, normalizeCode(code));
  await audit(actor, active ? "voucher.enable" : "voucher.disable", code);
}

export async function deleteVoucher(code: string, actor: string) {
  const c = normalizeCode(code);
  await tx(async (d) => {
    const r = (await d.prepare("SELECT used_count FROM vouchers WHERE code = ? FOR UPDATE").get(c)) as { used_count: number } | undefined;
    if (!r) return;
    if (r.used_count > 0) throw new VoucherAdminError("This voucher has been used. Switch it off instead of deleting it, so the order history stays correct.");
    await d.prepare("DELETE FROM vouchers WHERE code = ?").run(c);
  });
  await audit(actor, "voucher.delete", c);
}

export async function listVouchers(): Promise<Voucher[]> {
  return ((await db().prepare("SELECT * FROM vouchers ORDER BY created_at DESC, code").all()) as Row[]).map(toVoucher);
}
