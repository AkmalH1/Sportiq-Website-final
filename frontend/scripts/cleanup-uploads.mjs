// Removes ABANDONED uploads: files in data/uploads and data/private/proofs that no database row mentions and that are older than N days.
//   node --experimental-strip-types scripts/cleanup-uploads.mjs [--days 30] [--apply]
// DRY-RUN by default (lists what it would do). --apply MOVES the files to data/trash/<date>/ (undo = move them back); it never deletes.
// Add --purge-trash-days 30 together with --apply to permanently delete trash folders older than that.
// Safety: references are collected from EVERY text column of EVERY table; if any query fails nothing is touched.
// Run it from the folder that contains data/ (inside the container: docker compose exec web node --experimental-strip-types scripts/cleanup-uploads.mjs).
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { extractReferences, isStaleTemp, selectOrphans } from "../lib/upload-retention.ts";

const a = process.argv.slice(2);
const apply = a.includes("--apply");
const num = (k, d) => { const i = a.indexOf(k); return i >= 0 ? Number(a[i + 1]) : d; };
const days = num("--days", 30);
const purgeDays = num("--purge-trash-days", 0);
if (!(days >= 1)) { console.error("--days must be at least 1"); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set"); process.exit(2); }
const u = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});
const refs = new Set();
try {
  const [cols] = await conn.query("SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema = DATABASE() AND data_type IN ('char','varchar','tinytext','text','mediumtext','longtext','json')");
  for (const { t, c } of cols) {
    const [rows] = await conn.query(`SELECT \`${c}\` v FROM \`${t}\` WHERE \`${c}\` LIKE '%.webp%'`);
    for (const r of rows) extractReferences(String(r.v ?? ""), refs);
  }
} catch (e) { console.error("Could not read the database; nothing was changed:", e.message); process.exit(1); }
await conn.end();
console.log(`References found in the database: ${refs.size}`);

const data = path.join(process.cwd(), "data");
const now = Date.now();
const stamp = new Date().toISOString().slice(0, 10);
let total = 0, bytes = 0;
for (const sub of ["uploads", path.join("private", "proofs")]) {
  const dir = path.join(data, sub);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => ({ name: e.name, mtimeMs: statSync(path.join(dir, e.name)).mtimeMs, size: statSync(path.join(dir, e.name)).size }));
  const doomed = [...selectOrphans(files, refs, days, now), ...files.filter((f) => isStaleTemp(f, now)).map((f) => f.name)];
  for (const name of doomed) {
    const size = files.find((f) => f.name === name)?.size ?? 0;
    total++; bytes += size;
    console.log(`${apply ? "MOVE" : "would move"} ${sub}/${name} (${size} bytes)`);
    if (apply) { const to = path.join(data, "trash", stamp, sub); mkdirSync(to, { recursive: true }); renameSync(path.join(dir, name), path.join(to, name)); }
  }
}
console.log(`${apply ? "Moved" : "Would move"} ${total} file(s), ${(bytes / 1048576).toFixed(1)} MB (unreferenced and older than ${days} days).${apply ? " They are in data/trash/." : " Dry-run: re-run with --apply to do it."}`);
if (apply && purgeDays > 0 && existsSync(path.join(data, "trash"))) {
  for (const d of readdirSync(path.join(data, "trash"))) {
    const p = path.join(data, "trash", d);
    if (statSync(p).mtimeMs < now - purgeDays * 86400_000) { rmSync(p, { recursive: true, force: true }); console.log(`Purged trash folder ${d}`); }
  }
}
