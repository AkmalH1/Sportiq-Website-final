import test from "node:test";
import assert from "node:assert/strict";
import { BodyTooLarge, GateFull, createGate, parseFormLimited, readBodyLimited, safeAdminPath, sameOrigin, storageDecision } from "../../lib/request-guard.ts";

const streamOf = (n: number, chunk = 1000) => new ReadableStream<Uint8Array>({
  pull(c) { if (n <= 0) return c.close(); const k = Math.min(chunk, n); n -= k; c.enqueue(new Uint8Array(k)); },
});
const req = (body: BodyInit | null, headers: Record<string, string> = {}) => new Request("http://x/", { method: "POST", body, headers, duplex: "half" } as RequestInit);

test("stream is cut at the limit even with no / a lying Content-Length", async () => {
  await assert.rejects(readBodyLimited(req(streamOf(50_000), { "content-length": "10" }), 10_000), BodyTooLarge);
  await assert.rejects(readBodyLimited(req(streamOf(50_000)), 10_000), BodyTooLarge);
  await assert.rejects(readBodyLimited(req(streamOf(5), { "content-length": "99999999" }), 10_000), BodyTooLarge);
  assert.equal((await readBodyLimited(req(streamOf(9_999)), 10_000)).length, 9_999);
});
test("multipart is parsed only after the size check", async () => {
  const fd = new FormData(); fd.set("a", "1"); fd.set("file", new File([new Uint8Array(3000)], "f.bin"));
  const r = new Request("http://x/", { method: "POST", body: fd });
  const parsed = await parseFormLimited(r, 100_000);
  assert.equal((parsed.get("file") as File).size, 3000);
  const big = new FormData(); big.set("file", new File([new Uint8Array(200_000)], "f.bin"));
  await assert.rejects(parseFormLimited(new Request("http://x/", { method: "POST", body: big }), 50_000), BodyTooLarge);
  await assert.rejects(parseFormLimited(req("x", { "content-type": "application/json" }), 100), TypeError);
});
test("gate: limits concurrency, bounded queue, releases slots", async () => {
  const g = createGate(2, 1); let running = 0, peak = 0;
  const job = () => g.run(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 20)); running--; });
  const results = await Promise.allSettled([job(), job(), job(), job(), job()]);
  assert.equal(peak, 2);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof GateFull));
  assert.equal(g.active, 0); await job(); assert.equal(g.active, 0);
});
test("sameOrigin", () => {
  assert.ok(sameOrigin(new Headers({ host: "a.lk" })));
  assert.ok(sameOrigin(new Headers({ host: "a.lk", origin: "https://a.lk" })));
  assert.ok(!sameOrigin(new Headers({ host: "a.lk", origin: "https://evil.com" })));
  assert.ok(!sameOrigin(new Headers({ host: "a.lk", origin: "null" })));
  assert.ok(sameOrigin(new Headers({ host: "web:3000", "x-forwarded-host": "a.lk", origin: "https://a.lk" })));
});
test("safeAdminPath accepts internal admin pages only", () => {
  for (const ok of ["/admin", "/admin?q=a%20b&status=paid", "/admin/batches/12", "/admin/orders/SIQ-1".toLowerCase()]) assert.equal(safeAdminPath(ok), ok);
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/admin/../x", "/adminx", "/admin//evil.com", "javascript:alert(1)", "/admin/login", "/admin/proof/x", "/other", "/admin?x=<script>", "", null, 5, "/admin\n/x", "/admin/a/b/c/d"]) assert.equal(safeAdminPath(bad), "/admin", String(bad));
});
test("storage quota", () => {
  assert.equal(storageDecision(1e12, 1, 0, true), "ok");
  assert.equal(storageDecision(80, 5, 100, true), "ok");
  assert.equal(storageDecision(88, 5, 100, true), "full");
  assert.equal(storageDecision(88, 5, 100, false), "ok");
  assert.equal(storageDecision(98, 5, 100, false), "full");
});
