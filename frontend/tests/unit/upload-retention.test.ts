import test from "node:test";
import assert from "node:assert/strict";
import { extractReferences, isStaleTemp, selectOrphans } from "../../lib/upload-retention.ts";
const A = "a".repeat(32) + ".webp", B = "b".repeat(32) + ".webp", C = "c".repeat(32) + ".webp";
const DAY = 86400_000, now = 1_800_000_000_000;
test("references are found in URLs, JSON galleries and bare names", () => {
  const r = extractReferences(`/uploads/${A} and ["/uploads/${B.toUpperCase()}"]`);
  assert.deepEqual([...r].sort(), [A, B]);
});
test("only unreferenced, old, well-formed names are selected", () => {
  const files = [{ name: A, mtimeMs: now - 90 * DAY }, { name: B, mtimeMs: now - 90 * DAY }, { name: C, mtimeMs: now - 2 * DAY }, { name: "logo.png", mtimeMs: 0 }, { name: "../x.webp", mtimeMs: 0 }];
  assert.deepEqual(selectOrphans(files, new Set([A]), 30, now), [B]);
  assert.deepEqual(selectOrphans(files, new Set([A, B]), 30, now), []);
  assert.deepEqual(selectOrphans(files, new Set(), 0, now).sort(), [A, B, C].sort()); // days is clamped to >= 1, so a 2-day-old file qualifies
});
test("stale temp files", () => {
  assert.ok(isStaleTemp({ name: ".x.1234.tmp", mtimeMs: now - 2 * 3600_000 }, now));
  assert.ok(!isStaleTemp({ name: ".x.1234.tmp", mtimeMs: now - 60_000 }, now));
  assert.ok(!isStaleTemp({ name: A, mtimeMs: 0 }, now));
});
