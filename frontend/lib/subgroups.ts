import "server-only";
import { audit, db } from "./db";
import { slugify } from "./categories";
import { OrderError } from "./orders";
import { parseBrands, type Brand } from "./brands";

export type { Brand };
export type Subgroup = { id: number; sportSlug: string; subSlug: string; slug: string; name: string; brands: Brand[]; brandsText: string; sort: number; active: boolean };
type Row = { id: number; sport_slug: string; subcategory_slug: string; slug: string; name: string; brands: string; sort: number; active: number };
const toGroup = (r: Row): Subgroup => ({
  id: r.id, sportSlug: r.sport_slug, subSlug: r.subcategory_slug, slug: r.slug, name: r.name,
  brands: parseBrands(r.brands), brandsText: r.brands, sort: r.sort, active: !!r.active,
});

/** Every subgroup, including hidden ones (admin, product form, import). */
export async function listSubgroupsAdmin(): Promise<Subgroup[]> {
  return ((await db().prepare("SELECT * FROM subgroups ORDER BY sport_slug, subcategory_slug, sort, name").all()) as Row[]).map(toGroup);
}

/** Storefront: active subgroups of one sport. The page decides which have published products. */
export async function listSubgroups(sport: string): Promise<Subgroup[]> {
  return ((await db().prepare("SELECT * FROM subgroups WHERE sport_slug = ? AND active = 1 ORDER BY subcategory_slug, sort, name").all(sport)) as Row[]).map(toGroup);
}

export async function addSubgroup(sportSlug: string, subSlug: string, name: string, actor: string) {
  const slug = slugify(name);
  if (!slug) throw new OrderError("Enter a name.");
  if (!(await db().prepare("SELECT 1 FROM subcategories WHERE sport_slug = ? AND slug = ?").get(sportSlug, subSlug))) throw new OrderError("Unknown subcategory.");
  if (await db().prepare("SELECT 1 FROM subgroups WHERE sport_slug = ? AND slug = ?").get(sportSlug, slug)) throw new OrderError("A subgroup with that name already exists in this category. Use a different name.");
  const next = ((await db().prepare("SELECT COALESCE(MAX(sort),-1)+1 AS n FROM subgroups WHERE sport_slug = ? AND subcategory_slug = ?").get(sportSlug, subSlug)) as { n: number }).n;
  await db().prepare("INSERT INTO subgroups (sport_slug, subcategory_slug, slug, name, brands, sort) VALUES (?,?,?,?,?,?)").run(sportSlug, subSlug, slug, name.trim().slice(0, 80), "", next);
  await audit(actor, "subgroup.add", `${sportSlug}/${subSlug}/${slug}`);
}

export async function saveSubgroup(id: number, v: { name: string; brands: string; sort: number; active: boolean }, actor: string) {
  if (v.name.trim().length < 1) throw new OrderError("Enter a name.");
  const brands = parseBrands(v.brands);
  if (brands.length > 60) throw new OrderError("At most 60 brands per subgroup.");
  await db().prepare("UPDATE subgroups SET name=?, brands=?, sort=?, active=? WHERE id=?").run(v.name.trim().slice(0, 80), brands.map((b) => b.name).join("\n"), v.sort, v.active ? 1 : 0, id);
  await audit(actor, "subgroup.update", String(id));
}

export async function deleteSubgroup(id: number, actor: string) {
  const g = (await db().prepare("SELECT sport_slug, slug FROM subgroups WHERE id = ?").get(id)) as { sport_slug: string; slug: string } | undefined;
  if (!g) return;
  const n = ((await db().prepare("SELECT COUNT(*) AS n FROM products WHERE sport_slug = ? AND subgroup_slug = ?").get(g.sport_slug, g.slug)) as { n: number }).n;
  if (n > 0) throw new OrderError(`${n} product(s) use this subgroup. Move them first, or hide it instead.`);
  await db().prepare("DELETE FROM subgroups WHERE id = ?").run(id);
  await audit(actor, "subgroup.delete", String(id));
}
