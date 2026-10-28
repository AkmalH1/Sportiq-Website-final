import "server-only";
import { audit, db } from "./db";
import { slugify } from "./categories";
import { OrderError } from "./orders";

export type Competition = { id: number; sportSlug: string; slug: string; name: string; logoUrl: string; sort: number; active: boolean };
type Row = { id: number; sport_slug: string; slug: string; name: string; logo_url: string; sort: number; active: number };
const toComp = (r: Row): Competition => ({ id: r.id, sportSlug: r.sport_slug, slug: r.slug, name: r.name, logoUrl: r.logo_url, sort: r.sort, active: !!r.active });

/**
 * Competitions to show in a sport's navigation: active ones that have at least one PUBLISHED product,
 * with the real product count. A competition with no products never appears.
 */
export async function listNavCompetitions(sport: string): Promise<(Competition & { count: number })[]> {
  const rows = (await db()
    .prepare(
      `SELECT c.*, COUNT(p.id) AS n FROM competitions c
       JOIN products p ON p.sport_slug = c.sport_slug AND p.competition_slug = c.slug AND p.status = 'published'
       WHERE c.sport_slug = ? AND c.active = 1 GROUP BY c.id ORDER BY c.sort, c.name`,
    )
    .all(sport)) as (Row & { n: number })[];
  return rows.map((r) => ({ ...toComp(r), count: Number(r.n) }));
}

/** Admin: every competition, including hidden and empty ones. */
export async function listCompetitionsAdmin(): Promise<Competition[]> {
  return ((await db().prepare("SELECT * FROM competitions ORDER BY sport_slug, sort, name").all()) as Row[]).map(toComp);
}

const safeLogo = (u: string) => {
  const v = u.trim();
  if (v === "") return "";
  if (/^https:\/\/[^\s"'<>]+$/i.test(v) || /^\/uploads\/[A-Za-z0-9._-]+$/.test(v)) return v.slice(0, 500);
  throw new OrderError("Logo must be an https:// link or an image already uploaded to this site.");
};

export async function addCompetition(sportSlug: string, name: string, actor: string) {
  const slug = slugify(name);
  if (!slug) throw new OrderError("Enter a name.");
  if (!(await db().prepare("SELECT 1 FROM sports WHERE slug = ?").get(sportSlug))) throw new OrderError("Unknown category.");
  if (await db().prepare("SELECT 1 FROM competitions WHERE sport_slug = ? AND slug = ?").get(sportSlug, slug)) throw new OrderError("That competition already exists.");
  const next = ((await db().prepare("SELECT COALESCE(MAX(sort),-1)+1 AS n FROM competitions WHERE sport_slug = ?").get(sportSlug)) as { n: number }).n;
  await db().prepare("INSERT INTO competitions (sport_slug, slug, name, sort) VALUES (?,?,?,?)").run(sportSlug, slug, name.trim().slice(0, 80), next);
  await audit(actor, "competition.add", `${sportSlug}/${slug}`);
}

export async function saveCompetition(id: number, v: { name: string; logo: string; sort: number; active: boolean }, actor: string) {
  if (v.name.trim().length < 1) throw new OrderError("Enter a name.");
  await db().prepare("UPDATE competitions SET name=?, logo_url=?, sort=?, active=? WHERE id=?").run(v.name.trim().slice(0, 80), safeLogo(v.logo), v.sort, v.active ? 1 : 0, id);
  await audit(actor, "competition.update", String(id));
}

export async function deleteCompetition(id: number, actor: string) {
  const c = (await db().prepare("SELECT sport_slug, slug FROM competitions WHERE id = ?").get(id)) as { sport_slug: string; slug: string } | undefined;
  if (!c) return;
  const n = ((await db().prepare("SELECT COUNT(*) AS n FROM products WHERE sport_slug = ? AND competition_slug = ?").get(c.sport_slug, c.slug)) as { n: number }).n;
  if (n > 0) throw new OrderError(`${n} product(s) use this competition. Move them first, or hide it instead.`);
  await db().prepare("DELETE FROM competitions WHERE id = ?").run(id);
  await audit(actor, "competition.delete", String(id));
}
