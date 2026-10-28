import "server-only";
import readXlsxFile from "read-excel-file/node";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import type { Sheet } from "./scraperx";

const MAX_ROWS_PER_SHEET = 10000;
const MAX_SHEETS = 10;

/**
 * Some exporters (ScraperX, openpyxl) write blank cells as <c t="inlineStr"/> with no content, which the reader rejects.
 * Strip the pointless type from those empty cells. Real content is never touched.
 */
function repairEmptyInlineCells(buf: Buffer): Buffer {
  try {
    let total = 0;
    const files = unzipSync(new Uint8Array(buf), { filter: (f) => { total += f.originalSize; if (total > 100 * 1024 * 1024) throw new Error("too large"); return true; } }); // zip-bomb guard
    let changed = false;
    for (const [name, data] of Object.entries(files)) {
      if (!/^xl\/worksheets\/[^/]+\.xml$/.test(name)) continue;
      const xml = strFromU8(data);
      const fixed = xml
        .replace(/<c([^>]*?)\st="inlineStr"([^>]*?)\s*\/>/g, "<c$1$2/>")
        .replace(/<c([^>]*?)\st="inlineStr"([^>]*?)>\s*<\/c>/g, "<c$1$2/>");
      if (fixed !== xml) { files[name] = strToU8(fixed); changed = true; }
    }
    return changed ? Buffer.from(zipSync(files)) : buf;
  } catch {
    return buf; // not repairable here: the normal reader will report the real problem
  }
}

/** Reads every sheet of an .xlsx upload as plain rows. The caller has already checked the size and the "PK" signature. */
export async function readWorkbook(original: Buffer): Promise<Sheet[]> {
  const buf = repairEmptyInlineCells(original);
  let names: string[];
  try {
    const list = readXlsxFile as unknown as (b: Buffer, o: { getSheets: true }) => Promise<{ name: string }[]>; // typings omit getSheets
    names = (await list(buf, { getSheets: true })).map((s) => s.name);
  } catch {
    throw new Error("That file could not be read as an Excel workbook (.xlsx). Re-save it from Excel and try again.");
  }
  const sheets: Sheet[] = [];
  for (const name of names.slice(0, MAX_SHEETS)) {
    let rows: unknown[][];
    try {
      rows = (await readXlsxFile(buf, { sheet: name })) as unknown[][];
    } catch (e) {
      throw new Error(`Sheet "${name}" could not be read (${e instanceof Error ? e.message : "unknown error"}). Re-save the file from Excel as .xlsx, or export it as CSV.`);
    }
    if (rows.length > MAX_ROWS_PER_SHEET + 1) throw new Error(`Sheet "${name}" has more than ${MAX_ROWS_PER_SHEET} rows. Split it into smaller files.`);
    sheets.push({ name, rows });
  }
  return sheets;
}

/** Cell to text. Whole numbers stay whole ("4900", not "4900.0"); dates become ISO text. */
export const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};
