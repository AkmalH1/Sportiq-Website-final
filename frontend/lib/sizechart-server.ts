import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { parseChart, type SizeChart } from "./sizechart";

/** Size chart for a product: its subcategory's chart, else its category's, else the store default. */
export async function chartFor(sportSlug: string, subSlug: string): Promise<SizeChart | null> {
  const sub = subSlug
    ? (((await db().prepare("SELECT size_chart FROM subcategories WHERE sport_slug = ? AND slug = ?").get(sportSlug, subSlug)) as { size_chart: string } | undefined)?.size_chart ?? "")
    : "";
  const sport = ((await db().prepare("SELECT size_chart FROM sports WHERE slug = ?").get(sportSlug)) as { size_chart: string } | undefined)?.size_chart ?? "";
  return parseChart(sub) ?? parseChart(sport) ?? parseChart((await getSettings()).size_chart_default);
}
