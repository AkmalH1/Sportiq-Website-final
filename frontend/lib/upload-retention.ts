/** Pure rules for removing abandoned uploads (no I/O; unit-tested in tests/unit/upload-retention.test.ts). */

/** Every stored image name has the form <32 hex>.webp. Any text that mentions one counts as a reference to it. */
export function extractReferences(text: string, into: Set<string> = new Set()): Set<string> {
  for (const m of text.matchAll(/[0-9a-f]{32}\.webp/gi)) into.add(m[0].toLowerCase());
  return into;
}

export type FileInfo = { name: string; mtimeMs: number };
/** Files to remove: stored-image names only, NOT referenced anywhere, and older than `days`. Anything else (temp files are handled separately, odd names, young files) is kept. */
export function selectOrphans(files: FileInfo[], referenced: Set<string>, days: number, nowMs: number): string[] {
  const cutoff = nowMs - Math.max(1, days) * 86400_000;
  return files.filter((f) => /^[0-9a-f]{32}\.webp$/i.test(f.name) && !referenced.has(f.name.toLowerCase()) && f.mtimeMs < cutoff).map((f) => f.name);
}
/** Leftover temp files of interrupted writes (older than an hour). */
export const isStaleTemp = (f: FileInfo, nowMs: number) => /^\..+\.tmp$/.test(f.name) && f.mtimeMs < nowMs - 3600_000;
