/** Pure helpers for the brand list of a subgroup. No server-only imports, so tests and the client can use them. */
export type Brand = { slug: string; name: string };

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** One brand per line or comma separated. Blank, duplicate (same slug) and over-long entries are dropped. */
export function parseBrands(text: string): Brand[] {
  const seen = new Set<string>();
  const out: Brand[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, 40);
    const s = slug(name);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push({ slug: s, name });
  }
  return out;
}
