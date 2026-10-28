import test from "node:test";
import assert from "node:assert/strict";
import { checkEnv, mfaBypassAllowed } from "../../lib/env-check.ts";

const good = {
  NODE_ENV: "production", DATABASE_URL: "mysql://sportiq:Xk9fQ2mLp7vR4tZw@db:3306/sportiq", SESSION_SECRET: "k3Jd9sLq0Pz7VbN2mXc8Rt5Yw1Hg6FaE4u",
  ADMIN_PASSWORD_HASH: "scrypt:" + "ab".repeat(16) + ":" + "cd".repeat(64), ADMIN_TOTP_SECRET: "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU",
  SITE_URL: "https://shop.lk", ADMIN_HOST: "staff.shop.lk", BANK_NAME: "B", BANK_ACCOUNT_NAME: "N", BANK_ACCOUNT_NUMBER: "1",
  ALERT_WEBHOOK_URL: "https://ntfy.sh/x", PROXY_AUTH_SECRET: "p".repeat(10) + "q".repeat(10) + "r2s3t4",
};
const errs = (o: Record<string, string | undefined>) => checkEnv({ ...good, ...o }).errors;

test("a correct production config passes", () => assert.deepEqual(errs({}), []));
test("MFA escape hatch: ignored in production, and its presence is an error", () => {
  assert.equal(mfaBypassAllowed({ NODE_ENV: "production", ADMIN_MFA_OPTIONAL: "true" }), false);
  assert.equal(mfaBypassAllowed({ NODE_ENV: "development", ADMIN_MFA_OPTIONAL: "true" }), true);
  assert.equal(mfaBypassAllowed({ NODE_ENV: "development" }), false);
  assert.ok(errs({ ADMIN_MFA_OPTIONAL: "true" }).some((m) => m.includes("ADMIN_MFA_OPTIONAL")));
  assert.ok(errs({ ADMIN_TOTP_SECRET: undefined, ADMIN_MFA_OPTIONAL: "true" }).some((m) => m.includes("ADMIN_TOTP_SECRET")));
});
test("missing / weak / default secrets are rejected", () => {
  assert.ok(errs({ SESSION_SECRET: undefined }).length);
  assert.ok(errs({ SESSION_SECRET: "short" }).length);
  assert.ok(errs({ SESSION_SECRET: "testsecret1234567890-abcdefghijklmnop" }).length);
  assert.ok(errs({ SESSION_SECRET: "a".repeat(40) }).length);
  assert.ok(errs({ ADMIN_PASSWORD_HASH: undefined }).length);
  assert.ok(errs({ ADMIN_PASSWORD_HASH: "plain" }).length);
  assert.ok(errs({ ADMIN_PASSWORD: "x" }).length);
  assert.ok(errs({ ADMIN_TOTP_SECRET: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" }).length);
  assert.ok(errs({ DATABASE_URL: "mysql://sportiq:sportiq@db/sportiq" }).length);
  assert.ok(errs({ DATABASE_URL: "mysql://u:Xk9fQ2mLp7vR4tZw@db.example.com/x" }).length);
});
test("addresses and hostnames", () => {
  assert.ok(errs({ SITE_URL: "http://shop.lk" }).length);
  assert.ok(errs({ SITE_URL: "https://localhost:3000" }).length);
  assert.ok(errs({ ADMIN_HOST: undefined }).length);
  assert.ok(errs({ ADMIN_HOST: "shop.lk" }).length);
  assert.ok(errs({ ADMIN_HOST: "https://staff.shop.lk" }).length);
  assert.ok(errs({ PAYHERE_NOTIFY_HOST: "staff.shop.lk" }).length);
});
test("payment credentials", () => {
  const ph = { PAYHERE_MERCHANT_ID: "1200001", PAYHERE_MERCHANT_SECRET: "Zr8Qm2Lk9Wp4Xv7Nb3Tc" };
  assert.ok(errs({ ...ph }).some((m) => m.includes("PAYHERE_MODE")));
  assert.ok(errs({ ...ph, PAYHERE_MODE: "live" }).some((m) => m.includes("PAYHERE_APP_ID")));
  assert.deepEqual(errs({ ...ph, PAYHERE_MODE: "live", PAYHERE_APP_ID: "a", PAYHERE_APP_SECRET: "b" }), []);
  assert.ok(errs({ ...ph, PAYHERE_MODE: "live", PAYHERE_APP_ID: "a", PAYHERE_APP_SECRET: "b", PAYHERE_API_BASE: "http://x" }).length);
  assert.ok(errs({ PAYHERE_MERCHANT_ID: "1" }).length);
});
test("client-address trust and numbers", () => {
  assert.ok(errs({ CLIENT_IP_HEADER: "cf-connecting-ip", PROXY_AUTH_SECRET: undefined }).length);
  assert.ok(errs({ DB_POOL_SIZE: "ten" }).length);
  assert.ok(errs({ DB_POOL_SIZE: "500" }).length);
  assert.deepEqual(errs({ DB_POOL_SIZE: "20" }), []);
});
test("messages never contain secret values", () => {
  const r = checkEnv({ ...good, SESSION_SECRET: "SUPERSECRETVALUE", PAYHERE_MERCHANT_ID: "1", PAYHERE_MERCHANT_SECRET: "LEAKME123", DATABASE_URL: "mysql://u:LEAKPASS@db/x" });
  const all = [...r.errors, ...r.warnings].join("\n");
  for (const s of ["SUPERSECRETVALUE", "LEAKME123", "LEAKPASS"]) assert.ok(!all.includes(s));
});
test("non-production: only syntax errors", () => assert.deepEqual(checkEnv({ NODE_ENV: "development", DATABASE_URL: "mysql://u:p@127.0.0.1/x" }).errors, []));
