export type SizeChart = { headers: string[]; rows: string[][]; notes: string[] };

/** Parses the admin text format: comma separated lines, first line is the header, lines starting with # are notes. */
export function parseChart(text: string): SizeChart | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const notes = lines.filter((l) => l.startsWith("#")).map((l) => l.replace(/^#\s*/, ""));
  const body = lines.filter((l) => !l.startsWith("#")).map((l) => l.split(",").map((c) => c.trim()));
  if (body.length < 2) return null;
  const width = body[0].length;
  return { headers: body[0], rows: body.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")), notes };
}
