import "server-only";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { alertOnce } from "./alert";
import { storageDecision } from "./request-guard";

/** Largest accepted image file (bytes). The routes enforce their own, tighter body limits before this is reached. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Image decoding is the expensive part of an upload: keep libvips small and predictable (a few threads, small cache).
sharp.concurrency(Math.max(1, Number(process.env.SHARP_CONCURRENCY || 2)));
sharp.cache({ memory: 64, files: 0, items: 50 });

export class StorageFullError extends Error {
  constructor() { super("Uploads are paused because storage is nearly full. Please try again later."); }
}

const DATA = () => path.join(process.cwd(), "data");

/** Total bytes under data/ (uploads, private proofs). Cached for a minute: a directory walk per upload would be wasteful. */
let usage: { at: number; bytes: number } | null = null;
function walk(dir: string): number {
  let sum = 0;
  let entries: import("node:fs").Dirent[];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    try { sum += e.isDirectory() ? walk(p) : statSync(p).size; } catch { /* file vanished while walking */ }
  }
  return sum;
}
export function storageUsedBytes(force = false): number {
  if (!force && usage && Date.now() - usage.at < 60_000) return usage.bytes;
  usage = { at: Date.now(), bytes: walk(DATA()) };
  return usage.bytes;
}
/** STORAGE_QUOTA_MB (default 10240 = 10 GB; 0 turns the check off). */
export const storageQuotaBytes = () => Math.max(0, Number(process.env.STORAGE_QUOTA_MB ?? 10240)) * 1024 * 1024;

/** Logs and alerts the owner (at most every 6 hours) when storage passes 80% of the quota. Called by housekeeping and on every save. */
export function monitorStorage(): { usedBytes: number; quotaBytes: number } {
  const usedBytes = storageUsedBytes();
  const quotaBytes = storageQuotaBytes();
  if (quotaBytes > 0 && usedBytes > quotaBytes * 0.8) {
    void alertOnce("storage-80", `Photo storage is at ${Math.round((usedBytes / quotaBytes) * 100)}% of its ${Math.round(quotaBytes / 1048576)} MB limit. Run the cleanup script (scripts/cleanup-uploads.mjs) or enlarge the volume.`, 6 * 3600_000);
  }
  return { usedBytes, quotaBytes };
}

/** Throws StorageFullError when this save would pass the quota. `isPublic`: customer uploads may only use 90% so staff can still work. */
export function assertStorageRoom(addBytes: number, isPublic: boolean) {
  const { usedBytes, quotaBytes } = monitorStorage();
  if (storageDecision(usedBytes, addBytes, quotaBytes, isPublic) === "full") {
    void alertOnce(isPublic ? "storage-public-full" : "storage-full", "Uploads were refused because the storage limit was reached.", 3600_000);
    throw new StorageFullError();
  }
}

/** Write to a temporary name, then rename: a crash or full disk mid-write never leaves a half-written image that is later served. */
function writeAtomic(dir: string, name: string, data: Buffer) {
  mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${name}.${randomBytes(4).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path.join(dir, name));
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* nothing to clean */ }
    throw e;
  }
  if (usage) usage.bytes += data.length;
}

/** Checks the real file signature, then decodes and re-encodes the image (drops metadata, rejects non-images, caps size and decode cost). */
async function cleanImage(file: File): Promise<Buffer> {
  if (file.size === 0) throw new Error("No file selected.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is larger than 4 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("Image is larger than 4 MB.");
  let ext: string | null = null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = "jpg";
  else if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = "png";
  else if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") ext = "webp";
  if (!ext) throw new Error("Only JPG, PNG or WebP images are allowed.");
  // Decode and re-encode: drops metadata (GPS etc.), rejects files that are not really images, caps size for fast mobile loading.
  // limitInputPixels stops "decompression bomb" files (a tiny file that declares a gigantic picture); timeout bounds the CPU time of one decode.
  let out: Buffer;
  try {
    out = await sharp(buf, { limitInputPixels: 40_000_000, sequentialRead: true })
      .timeout({ seconds: 20 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("That file could not be read as an image.");
  }
  return out;
}

/** Saves an uploaded image for public use (product photos, reviews). Returns the public URL. `isPublic` = a customer (not staff) is uploading. */
export async function saveImage(file: File, isPublic = false): Promise<string> {
  assertStorageRoom(file.size, isPublic);
  const out = await cleanImage(file);
  const name = `${randomBytes(16).toString("hex")}.webp`;
  writeAtomic(path.join(DATA(), "uploads"), name, out);
  return `/uploads/${name}`;
}

/**
 * Payment receipt photos are private: stored outside the public uploads folder with a random name, and only served
 * to a logged-in staff member by /admin/proof/[name]. Returns the stored file name (not a URL).
 */
export async function savePrivateProof(file: File): Promise<string> {
  assertStorageRoom(file.size, true);
  const out = await cleanImage(file);
  const name = `${randomBytes(16).toString("hex")}.webp`;
  writeAtomic(path.join(DATA(), "private", "proofs"), name, out);
  return name;
}
