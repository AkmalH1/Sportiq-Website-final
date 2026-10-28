import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const d = db();
  const products = (await d.prepare("SELECT slug FROM products WHERE status = 'published'").all()) as { slug: string }[];
  const sports = (await d.prepare("SELECT slug FROM sports").all()) as { slug: string }[];
  const fixed = ["", "/shop", "/caps", "/about", "/returns", "/shipping", "/reviews", "/disclaimer"];
  return [
    ...fixed.map((p) => ({ url: SITE_URL + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...sports.filter((s) => s.slug !== "caps").map((s) => ({ url: `${SITE_URL}/sports/${s.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${SITE_URL}/products/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
