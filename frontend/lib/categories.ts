import "server-only";
import { db } from "./db";
import type { Sport } from "./types";

type SportRow = { slug: string; name: string; tagline: string; accent: string; sort: number; active: number; size_set: string; size_chart: string };
type SubRow = { id: number; sport_slug: string; slug: string; name: string; sort: number; active: number; size_chart: string };

export type SubCategory = { id: number; sportSlug: string; slug: string; name: string; sort: number; active: boolean; sizeChart: string };
export type AdminSport = Sport & { sort: number; active: boolean; subs: SubCategory[]; sizeSet: string; sizeChart: string };

const toSub = (r: SubRow): SubCategory => ({ id: r.id, sportSlug: r.sport_slug, slug: r.slug, name: r.name, sort: r.sort, active: !!r.active, sizeChart: r.size_chart });

/** Public list: only active sports, with active subcategory names. */
export async function listSports(): Promise<Sport[]> {
  const rows = (await db().prepare("SELECT * FROM sports WHERE active = 1 ORDER BY sort, name").all()) as SportRow[];
  const subs = (await db().prepare("SELECT * FROM subcategories WHERE active = 1 ORDER BY sort, name").all()) as SubRow[];
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    accent: r.accent,
    subcategories: subs.filter((s) => s.sport_slug === r.slug).map((s) => s.name),
  }));
}

export async function getSport(slug: string): Promise<Sport | undefined> {
  return (await listSports()).find((s) => s.slug === slug);
}

/** Admin list: everything, including hidden. */
export async function listSportsAdmin(): Promise<AdminSport[]> {
  const rows = (await db().prepare("SELECT * FROM sports ORDER BY sort, name").all()) as SportRow[];
  const subs = (await db().prepare("SELECT * FROM subcategories ORDER BY sort, name").all()) as SubRow[];
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    accent: r.accent,
    sort: r.sort,
    active: !!r.active,
    sizeSet: r.size_set,
    sizeChart: r.size_chart,
    subcategories: [],
    subs: subs.filter((s) => s.sport_slug === r.slug).map(toSub),
  }));
}

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export async function sportSlugs(): Promise<string[]> {
  return ((await db().prepare("SELECT slug FROM sports").all()) as { slug: string }[]).map((r) => r.slug);
}
