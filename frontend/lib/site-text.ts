import "server-only";
import { audit, db, tx } from "./db";
import { TEXT_BY_KEY, TEXT_DEFAULTS, cleanText, TEXT_DEFS } from "./site-text-defs";

export type SiteTexts = Record<string, string>;

/** Original wording, overridden by whatever the owner saved. Never throws: a database problem falls back to the original wording. */
export async function getTexts(): Promise<SiteTexts> {
  const out: SiteTexts = { ...TEXT_DEFAULTS };
  try {
    for (const r of (await db().prepare("SELECT k, value FROM site_texts").all()) as { k: string; value: string }[]) if (r.k in TEXT_BY_KEY) out[r.k] = r.value;
  } catch { /* table missing during first start: use the original wording */ }
  return out;
}

export const isOn = (t: SiteTexts, key: string) => t[key] !== "0";

/** Saves the submitted values. A value equal to the original wording (or empty) removes the override, so "reset" is just clearing the box. */
export async function saveTexts(values: Record<string, string>, actor: string) {
  let changed = 0;
  await tx(async (d) => {
    for (const def of TEXT_DEFS) {
      if (!(def.key in values)) continue;
      const v = cleanText(def, values[def.key]);
      if (v === "" || v === def.def) await d.prepare("DELETE FROM site_texts WHERE k = ?").run(def.key);
      else await d.prepare("INSERT INTO site_texts (k, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)").run(def.key, v);
      changed++;
    }
  });
  await audit(actor, "site-text.save", `${changed} fields`);
}
