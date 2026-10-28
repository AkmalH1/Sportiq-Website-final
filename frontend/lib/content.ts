import "server-only";
import { audit, db } from "./db";
import { OrderError } from "./orders";
import { slugify } from "./categories";
import type { Faq } from "./types";

/* FAQs and collections are stored in the database and edited in Admin > Content. */

export type FaqRow = { id: number; question: string; answer: string; sort: number; active: number };
export type Collection = { slug: string; name: string; blurb: string; from: string; to: string; match: string; sort: number; active: boolean };

export async function listFaqs(): Promise<Faq[]> {
  const rows = (await db().prepare("SELECT question, answer FROM faqs WHERE active = 1 ORDER BY sort, id").all()) as { question: string; answer: string }[];
  return rows.map((r) => ({ q: r.question, a: r.answer }));
}

export const listFaqsAdmin = async () => (await db().prepare("SELECT * FROM faqs ORDER BY sort, id").all()) as FaqRow[];

export async function saveFaq(id: number, v: { question: string; answer: string; sort: number; active: boolean }, actor: string) {
  const question = v.question.trim().slice(0, 300);
  const answer = v.answer.trim().slice(0, 2000);
  if (question.length < 5 || answer.length < 5) throw new OrderError("Write a question and an answer.");
  if (id) await db().prepare("UPDATE faqs SET question=?, answer=?, sort=?, active=? WHERE id=?").run(question, answer, v.sort, v.active ? 1 : 0, id);
  else await db().prepare("INSERT INTO faqs (question, answer, sort, active) VALUES (?,?,?,?)").run(question, answer, v.sort, v.active ? 1 : 0);
  await audit(actor, id ? "faq.update" : "faq.add", question.slice(0, 60));
}

export async function deleteFaq(id: number, actor: string) {
  await db().prepare("DELETE FROM faqs WHERE id = ?").run(id);
  await audit(actor, "faq.delete", String(id));
}

type CollectionRow = { slug: string; name: string; blurb: string; from_color: string; to_color: string; match_type: string; sort: number; active: number };
const toCollection = (r: CollectionRow): Collection => ({ slug: r.slug, name: r.name, blurb: r.blurb, from: r.from_color, to: r.to_color, match: r.match_type, sort: r.sort, active: !!r.active });

export async function listCollections(includeHidden = false): Promise<Collection[]> {
  const rows = (await db().prepare(`SELECT * FROM collections ${includeHidden ? "" : "WHERE active = 1"} ORDER BY sort, name`).all()) as CollectionRow[];
  return rows.map(toCollection);
}

export async function getCollection(slug: string): Promise<Collection | null> {
  const r = (await db().prepare("SELECT * FROM collections WHERE slug = ? AND active = 1").get(slug)) as CollectionRow | undefined;
  return r ? toCollection(r) : null;
}

const colour = (c: string, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);

export async function saveCollection(slug: string, v: { name: string; blurb: string; from: string; to: string; match: string; sort: number; active: boolean }, actor: string) {
  if (v.name.trim().length < 2) throw new OrderError("Enter a name.");
  await db()
    .prepare("UPDATE collections SET name=?, blurb=?, from_color=?, to_color=?, match_type=?, sort=?, active=? WHERE slug=?")
    .run(v.name.trim().slice(0, 80), v.blurb.trim().slice(0, 200), colour(v.from, "#111111"), colour(v.to, "#f4720a"), v.match.trim().slice(0, 60), v.sort, v.active ? 1 : 0, slug);
  await audit(actor, "collection.update", slug);
}

export async function addCollection(name: string, actor: string) {
  const slug = slugify(name);
  if (!slug) throw new OrderError("Enter a name.");
  if (await db().prepare("SELECT 1 FROM collections WHERE slug = ?").get(slug)) throw new OrderError("That collection already exists.");
  const next = ((await db().prepare("SELECT COALESCE(MAX(sort),0)+1 AS n FROM collections").get()) as { n: number }).n;
  await db().prepare("INSERT INTO collections (slug, name, sort) VALUES (?,?,?)").run(slug, name.trim().slice(0, 80), next);
  await audit(actor, "collection.add", slug);
}

export async function deleteCollection(slug: string, actor: string) {
  await db().prepare("DELETE FROM collections WHERE slug = ?").run(slug);
  await audit(actor, "collection.delete", slug);
}
