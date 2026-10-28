import "server-only";
import { randomInt } from "node:crypto";
import { audit, db, tx } from "./db";

export type Exchange = {
  id: number; order_reference: string; name: string; contact: string; item: string; reason: string;
  image_url: string; status: "new" | "approved" | "rejected" | "completed"; admin_note: string; created_at: string;
};

export async function addExchange(x: { reference: string; name: string; contact: string; item: string; reason: string; image: string }) {
  const name = x.name.trim().slice(0, 80);
  const contact = x.contact.trim().slice(0, 80);
  const reason = x.reason.trim().slice(0, 800);
  if (name.length < 2) throw new Error("Please enter your name.");
  if (contact.replace(/\D/g, "").length < 9 && !contact.includes("@")) throw new Error("Please enter a phone number or email we can reach you on.");
  if (reason.length < 10) throw new Error("Please tell us why you want to exchange (at least 10 characters).");
  if (x.image && !/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(x.image)) throw new Error("Invalid photo.");
  await db()
    .prepare("INSERT INTO exchange_requests (order_reference, name, contact, item, reason, image_url) VALUES (?,?,?,?,?,?)")
    .run(x.reference.trim().toUpperCase().slice(0, 20), name, contact, x.item.trim().slice(0, 120), reason, x.image);
}

export const listExchanges = async () => (await db().prepare("SELECT * FROM exchange_requests ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, id DESC LIMIT 200").all()) as Exchange[];

export async function setExchange(id: number, status: Exchange["status"], note: string, actor: string) {
  await db().prepare("UPDATE exchange_requests SET status = ?, admin_note = ? WHERE id = ?").run(status, note.slice(0, 500), id);
  await audit(actor, "exchange." + status, `#${id}`);
}

/* ---- store credit ---- */
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => "SC-" + Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

export type Credit = { code: string; email: string; balance: number; issued: number; note: string; created_at: string };

export async function issueCredit(email: string, amount: number, note: string, actor: string): Promise<string> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) throw new Error("Enter the credit amount as a whole number of LKR.");
  const e = email.trim().toLowerCase();
  if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("That email address does not look right.");
  const code = await tx(async (d) => {
    let c = newCode();
    while (await d.prepare("SELECT 1 FROM store_credits WHERE code = ?").get(c)) c = newCode();
    await d.prepare("INSERT INTO store_credits (code, email, balance, issued, note) VALUES (?,?,?,?,?)").run(c, e, amount, amount, note.slice(0, 200));
    await d.prepare("INSERT INTO credit_ledger (code, delta, note) VALUES (?,?,?)").run(c, amount, "Issued: " + note.slice(0, 120));
    return c;
  });
  await audit(actor, "credit.issue", `${code} LKR ${amount}`);
  return code;
}

export const listCredits = async () => (await db().prepare("SELECT * FROM store_credits ORDER BY created_at DESC, code DESC LIMIT 200").all()) as Credit[];
