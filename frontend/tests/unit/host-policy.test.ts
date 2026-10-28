import test from "node:test";
import assert from "node:assert/strict";
import { decideHostAccess as d, normalizePath } from "../../lib/host-policy.ts";

const env = { ADMIN_HOST: "staff.shop.lk" };
const act = (host: string, path: string, e = env) => d(host, path, e).action;

test("public host: shop and payment callback allowed, /admin denied in every spelling", () => {
  assert.equal(act("shop.lk", "/"), "allow");
  assert.equal(act("shop.lk", "/api/payhere/notify"), "allow");
  assert.equal(act("shop.lk", "/api/upload"), "allow");
  for (const p of ["/admin", "/admin/", "/Admin/orders", "//admin/x", "/%61dmin", "/admin/../admin", "/ADMIN"]) assert.equal(act("shop.lk", p), "deny", p);
});
test("staff host: admin + uploads + health only; API and shop denied", () => {
  for (const p of ["/admin", "/admin/orders/1", "/uploads/a.webp", "/api/health"]) assert.equal(act("staff.shop.lk", p), "allow", p);
  for (const p of ["/api/payhere/notify", "/api/upload", "/api/anything", "/shop", "/cart", "/api/health/x"]) assert.equal(act("staff.shop.lk", p), "deny", p);
  assert.deepEqual(d("staff.shop.lk", "/", env), { action: "redirect", to: "/admin" });
  assert.equal(act("STAFF.shop.lk:443", "/api/upload"), "deny");
});
test("callback host: only the notify path (and health); public host stops answering it", () => {
  const e = { ADMIN_HOST: "staff.shop.lk", PAYHERE_NOTIFY_HOST: "cb.shop.lk" };
  assert.equal(act("cb.shop.lk", "/api/payhere/notify", e), "allow");
  for (const p of ["/", "/admin", "/api/upload", "/shop"]) assert.equal(act("cb.shop.lk", p, e), "deny", p);
  assert.equal(act("shop.lk", "/api/payhere/notify", e), "deny");
  assert.equal(act("staff.shop.lk", "/api/payhere/notify", e), "deny");
  assert.equal(act("shop.lk", "/shop", e), "allow");
});
test("no ADMIN_HOST (development): no restriction", () => assert.equal(act("localhost", "/admin", {}), "allow"));
test("normalizePath tolerates bad encoding", () => assert.equal(normalizePath("/%E0%A4%A"), "/%e0%a4%a"));
