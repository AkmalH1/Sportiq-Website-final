/** Jersey customisation options. Pure helpers, safe to import from client and server. */

export type Patch = { text: string; image: string };
export type Version = "fan" | "player";
export type ItemOptions = {
  version: Version; // football: fan version (base price) or player version (extra charge)
  sleeve: "short" | "long";
  custom: string; // name / number wording, empty = no customisation
  customImage: string; // optional reference image URL
  patches: Patch[]; // up to 3
};

export type OptionPrices = { playerVersion: number; longSleeve: number; customisation: number; patches: [number, number, number] };

export const EMPTY_OPTIONS: ItemOptions = { version: "fan", sleeve: "short", custom: "", customImage: "", patches: [] };
const IMG = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;

const t = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Cleans untrusted options from the browser. Returns the safe version. */
export function normalizeOptions(raw: unknown): ItemOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const image = (v: unknown) => (typeof v === "string" && IMG.test(v) ? v : "");
  const patches: Patch[] = [];
  if (Array.isArray(o.patches)) {
    for (const p of o.patches.slice(0, 3)) {
      const pp = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const patch = { text: t(pp.text, 80), image: image(pp.image) };
      if (patch.text || patch.image) patches.push(patch);
    }
  }
  const custom = t(o.custom, 80);
  return {
    version: o.version === "player" ? "player" : "fan",
    sleeve: o.sleeve === "long" ? "long" : "short",
    custom,
    customImage: custom || image(o.customImage) ? image(o.customImage) : "",
    patches,
  };
}

/** Which versions a football product offers, from its "version" field: "Fan only", "Player only", anything else = both. */
export function versionsOffered(v: string): Version[] {
  const t = (v || "").toLowerCase();
  if (/fan\s*(version)?\s*only/.test(t)) return ["fan"];
  if (/player\s*(version)?\s*only/.test(t)) return ["player"];
  return ["fan", "player"];
}

export const isDefault = (o: ItemOptions) => o.version === "fan" && o.sleeve === "short" && !o.custom && !o.customImage && o.patches.length === 0;

/** Extra price per shirt. Customisation is charged once per shirt, patches by position. */
export function addonPerUnit(o: ItemOptions, p: OptionPrices): number {
  let sum = 0;
  if (o.version === "player") sum += p.playerVersion;
  if (o.sleeve === "long") sum += p.longSleeve;
  if (o.custom || o.customImage) sum += p.customisation;
  o.patches.forEach((_, i) => (sum += p.patches[i] ?? 0));
  return sum;
}

export const optionKey = (o: ItemOptions) => (isDefault(o) ? "" : JSON.stringify(o));

export function describeOptions(o: ItemOptions): string[] {
  const out: string[] = [];
  if (o.version === "player") out.push("Player Version");
  if (o.sleeve === "long") out.push("Long sleeves");
  if (o.custom) out.push(`Customisation: ${o.custom}`);
  else if (o.customImage) out.push("Customisation: see attached image");
  o.patches.forEach((p, i) => out.push(`Patch ${i + 1}: ${p.text || "see attached image"}`));
  return out;
}

export function parseOptions(json: string): ItemOptions {
  try {
    return normalizeOptions(JSON.parse(json));
  } catch {
    return { ...EMPTY_OPTIONS };
  }
}
