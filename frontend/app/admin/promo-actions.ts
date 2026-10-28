"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createVoucher, deleteVoucher, setVoucherActive, VoucherAdminError } from "@/lib/vouchers";

const PATH = "/admin/vouchers";
const go = (msg: string, ok: boolean): never => redirect(`${PATH}?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);

async function run(fd: FormData, okMsg: string, fn: (get: (k: string) => string, actor: string) => Promise<void>): Promise<never> {
  const actor = await requireAdmin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  try {
    await fn(get, actor);
  } catch (e) {
    return go(e instanceof VoucherAdminError ? e.message : "Something went wrong.", false);
  }
  revalidatePath(PATH);
  return go(okMsg, true);
}
const int = (s: string) => Math.round(Number(s || 0));

export async function createVoucherAction(fd: FormData) {
  await run(fd, "Voucher created.", (g, a) => createVoucher({
    code: g("code"), kind: g("kind"), value: int(g("value")), minSpend: int(g("min_spend")), maxDiscount: int(g("max_discount")),
    from: g("from"), to: g("to"), maxUses: int(g("max_uses")), perEmail: int(g("per_email")), note: g("note"),
  }, a));
}
export async function toggleVoucherAction(fd: FormData) {
  await run(fd, "Voucher updated.", (g, a) => setVoucherActive(g("code"), g("active") === "1", a));
}
export async function deleteVoucherAction(fd: FormData) {
  await run(fd, "Voucher deleted.", (g, a) => deleteVoucher(g("code"), a));
}
