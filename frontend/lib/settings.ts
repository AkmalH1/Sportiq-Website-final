import "server-only";
import { db, tx, type Handle } from "./db";
import { SETTING_DEFAULTS } from "./settings-defaults";

export type Settings = Record<keyof typeof SETTING_DEFAULTS, string>;

export async function getSettings(d: Handle = db()): Promise<Settings> {
  const rows = (await d.prepare("SELECT `key`, value FROM settings").all()) as { key: string; value: string }[];
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out as Settings;
}

export const getSetting = async (key: keyof typeof SETTING_DEFAULTS): Promise<string> => (await getSettings())[key] ?? "";

export async function setSettings(values: Record<string, string>) {
  await tx(async (d) => {
    for (const [k, v] of Object.entries(values)) {
      if (k in SETTING_DEFAULTS) await d.prepare("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)").run(k, v);
    }
  });
}

export const intSetting = (s: Settings, key: keyof typeof SETTING_DEFAULTS, fallback = 0) => {
  const n = Math.round(Number(s[key]));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Money/option prices for football jersey customisation, read from settings so staff can change them. */
export function optionPrices(s: Settings) {
  return {
    playerVersion: intSetting(s, "price_player_version", 400),
    longSleeve: intSetting(s, "price_sleeve_long", 500),
    customisation: intSetting(s, "price_custom", 700),
    patches: [intSetting(s, "price_patch_1", 300), intSetting(s, "price_patch_2", 200), intSetting(s, "price_patch_3", 100)] as [number, number, number],
  };
}

export const whatsappLink = (text: string, s: Settings) =>
  `https://wa.me/${s.whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
