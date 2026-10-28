import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../../lib/client-ip.ts";
const H = (o: Record<string, string>) => new Headers(o);
const S = "s".repeat(32);

test("with PROXY_AUTH_SECRET: forged headers without the proof are ignored", () => {
  const env = { PROXY_AUTH_SECRET: S };
  assert.equal(clientIp(H({ "x-forwarded-for": "1.2.3.4", "x-real-client-ip": "5.6.7.8" }), env), "direct");
  assert.equal(clientIp(H({ "x-proxy-auth": "wrong" + S, "x-forwarded-for": "1.2.3.4" }), env), "direct");
  assert.equal(clientIp(H({ "x-proxy-auth": S.slice(1), "x-forwarded-for": "1.2.3.4" }), env), "direct");
});
test("with the proof: Caddy's verified address wins; spoofed leading XFF entries are ignored", () => {
  const env = { PROXY_AUTH_SECRET: S };
  assert.equal(clientIp(H({ "x-proxy-auth": S, "x-real-client-ip": "9.9.9.9", "x-forwarded-for": "6.6.6.6, 9.9.9.9" }), env), "9.9.9.9");
  assert.equal(clientIp(H({ "x-proxy-auth": S, "x-forwarded-for": "6.6.6.6, 9.9.9.9" }), env), "9.9.9.9");
  assert.equal(clientIp(H({ "x-proxy-auth": S, "cf-connecting-ip": "8.8.8.8", "x-real-client-ip": "9.9.9.9" }), { ...env, CLIENT_IP_HEADER: "cf-connecting-ip" }), "8.8.8.8");
});
test("legacy mode (no secret) is unchanged", () => {
  assert.equal(clientIp(H({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }), {}), "9.9.9.9");
  assert.equal(clientIp(H({}), {}), "local");
});
