import { SIZES } from "./config.ts";

/** Column order of the SPORTIQ product import template (CSV or Excel). */
export const CSV_HEADERS = [
  "slug", "name", "sport", "type", "version", "price_lkr", "description", "status",
  "preorder_enabled", "preorder_eta", "image_url", "sku_prefix", "subcategory", "league", "customizable", "weight_g",
  ...SIZES.map((s) => `stock_${s}`), "stock_ONE", "competition", "subgroup", "brand",
] as const;
