import "server-only";
import { audit, db, tx } from "./db";
import { OrderError } from "./orders";

export type ReconRow = {
  id: number; order_id: number; payment_id: number | null; kind: string; amount: number; detail: string; status: string;
  resolution: string; resolution_note: string; refund_ref: string; created_at: string; resolved_at: string | null; resolved_by: string | null; reference: string;
};

export async function listRecon(status: "open" | "resolved"): Promise<ReconRow[]> {
  return (await db().prepare(
    `SELECT r.*, o.reference FROM reconciliation_items r JOIN orders o ON o.id = r.order_id WHERE r.status = ? ORDER BY r.id DESC LIMIT 200`,
  ).all(status)) as ReconRow[];
}

export const RESOLUTIONS = { refunded: "Refund sent to the customer", reinstated: "Order reinstated / re-created", store_credit: "Kept as store credit", no_action: "No action needed" } as const;

/** Staff close a reconciliation item. The original payment rows are never edited; the decision is recorded here and in the audit log. */
export async function resolveRecon(id: number, resolution: string, note: string, refundRef: string, actor: string) {
  if (!(resolution in RESOLUTIONS)) throw new OrderError("Choose what was done.");
  if (resolution === "refunded" && refundRef.trim().length < 3) throw new OrderError("Enter the refund reference (bank or gateway reference).");
  await tx(async (d) => {
    const r = (await d.prepare("SELECT * FROM reconciliation_items WHERE id = ? FOR UPDATE").get(id)) as ReconRow | undefined;
    if (!r) throw new OrderError("Item not found.");
    if (r.status !== "open") throw new OrderError("This item is already resolved.");
    await d.prepare("UPDATE reconciliation_items SET status='resolved', resolution=?, resolution_note=?, refund_ref=?, resolved_at=UTC_TIMESTAMP(), resolved_by=? WHERE id = ?")
      .run(resolution, note.trim().slice(0, 300), refundRef.trim().slice(0, 100), actor, id);
    await d.prepare("INSERT INTO order_events (order_id, stage, note, actor) VALUES (?,?,?,?)")
      .run(r.order_id, "Payment issue resolved", `${r.kind}: ${RESOLUTIONS[resolution as keyof typeof RESOLUTIONS]}${note ? ". " + note.trim().slice(0, 200) : ""}`, actor);
    await audit(actor, "recon.resolve", `#${id} ${r.kind} ${resolution}`, d);
  });
}

export type PaymentDashboard = {
  pendingOnline: { n: number; amount: number };
  verifiedOnline: { n: number; amount: number };
  pendingBank: { n: number; amount: number };
  failedOrCancelled: { n: number; amount: number };
  partial: { n: number; outstanding: number };
  openRecon: { n: number; amount: number };
};

export async function paymentDashboard(): Promise<PaymentDashboard> {
  const one = async (sql: string) => (await db().prepare(sql).get()) as { n: number; a: number | null };
  const [po, vo, pb, fc, pa, rc] = await Promise.all([
    one("SELECT COUNT(*) n, SUM(amount) a FROM payments WHERE provider='payhere' AND status='initiated' AND created_at > UTC_TIMESTAMP() - INTERVAL 2 DAY"),
    one("SELECT COUNT(*) n, SUM(COALESCE(received_amount, amount)) a FROM payments WHERE provider='payhere' AND status='success'"),
    one("SELECT COUNT(*) n, SUM(amount) a FROM payments WHERE provider='bank' AND status='submitted'"),
    one("SELECT COUNT(*) n, SUM(amount) a FROM payments WHERE status IN ('failed','cancelled','chargeback','rejected')"),
    one("SELECT COUNT(*) n, SUM(total - paid_amount) a FROM orders WHERE payment_status IN ('partial','failed') AND stage <> 'Cancelled'"),
    one("SELECT COUNT(*) n, SUM(amount) a FROM reconciliation_items WHERE status='open'"),
  ]);
  return {
    pendingOnline: { n: po.n, amount: po.a ?? 0 }, verifiedOnline: { n: vo.n, amount: vo.a ?? 0 }, pendingBank: { n: pb.n, amount: pb.a ?? 0 },
    failedOrCancelled: { n: fc.n, amount: fc.a ?? 0 }, partial: { n: pa.n, outstanding: pa.a ?? 0 }, openRecon: { n: rc.n, amount: rc.a ?? 0 },
  };
}

export async function listPartial() {
  return (await db().prepare(
    "SELECT reference, customer_name, total, paid_amount, due_now, balance_method, stage FROM orders WHERE payment_status IN ('partial','failed') AND stage <> 'Cancelled' ORDER BY id DESC LIMIT 100",
  ).all()) as { reference: string; customer_name: string; total: number; paid_amount: number; due_now: number; balance_method: string; stage: string }[];
}
