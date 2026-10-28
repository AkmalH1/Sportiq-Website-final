import "server-only";
import { db } from "./db";

export type Review = { id: number; product_slug: string; name: string; rating: number; body: string; image_url: string; status: string; created_at: string };

export async function addReview(r: { product: string; name: string; rating: number; body: string; image: string }) {
  const name = r.name.trim().slice(0, 60);
  const body = r.body.trim().slice(0, 1200);
  if (name.length < 2) throw new Error("Please enter your name.");
  if (body.length < 10) throw new Error("Please write a little more (at least 10 characters).");
  if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) throw new Error("Choose a star rating.");
  if (r.image && !/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(r.image)) throw new Error("Invalid photo.");
  await db().prepare("INSERT INTO reviews (product_slug, name, rating, body, image_url) VALUES (?,?,?,?,?)").run(r.product.slice(0, 80), name, r.rating, body, r.image);
}

export async function listApproved(opts: { product?: string; limit?: number } = {}): Promise<Review[]> {
  const where = opts.product ? "AND product_slug = ?" : "";
  const args: (string | number)[] = opts.product ? [opts.product] : [];
  return (await db().prepare(`SELECT * FROM reviews WHERE status = 'approved' ${where} ORDER BY id DESC LIMIT ?`).all(...args, opts.limit ?? 50)) as Review[];
}

export async function listForAdmin(status?: string): Promise<Review[]> {
  return (status
    ? await db().prepare("SELECT * FROM reviews WHERE status = ? ORDER BY id DESC LIMIT 200").all(status)
    : await db().prepare("SELECT * FROM reviews ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC LIMIT 200").all()) as Review[];
}

export async function setReviewStatus(id: number, status: "approved" | "rejected" | "pending") {
  await db().prepare("UPDATE reviews SET status = ? WHERE id = ?").run(status, id);
}

export async function deleteReview(id: number) {
  await db().prepare("DELETE FROM reviews WHERE id = ?").run(id);
}

export const pendingReviewCount = async () => ((await db().prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'").get()) as { n: number }).n;
