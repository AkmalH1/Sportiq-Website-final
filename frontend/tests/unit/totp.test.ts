// Run: node --experimental-strip-types --test tests/unit/*.test.ts   (Node 22+, no extra packages)
import test from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, newTotpSecret, totpCode, verifyTotp } from "../../lib/totp.ts";

// RFC 6238 Appendix B test vector (SHA-1, secret "12345678901234567890", T=59s -> 94287082; we use 6 digits -> 287082)
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("matches the RFC 6238 test vectors", () => {
  assert.equal(totpCode(RFC_SECRET, 59_000), "287082");
  assert.equal(totpCode(RFC_SECRET, 1111111109_000), "081804");
  assert.equal(totpCode(RFC_SECRET, 2000000000_000), "279037");
});

test("base32 round-trips", () => {
  const s = newTotpSecret();
  assert.equal(base32Encode(base32Decode(s)), s);
  assert.equal(s.length, 32);
});

test("accepts current and adjacent step, rejects others", () => {
  const now = 1_700_000_000_000;
  assert.notEqual(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now), now), null);
  assert.notEqual(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), now), null);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 120_000), now), null);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", now), null);
  assert.equal(verifyTotp(RFC_SECRET, "", now), null);
});

test("ignores spaces in the typed code", () => {
  const now = 1_700_000_000_000;
  const c = totpCode(RFC_SECRET, now);
  assert.notEqual(verifyTotp(RFC_SECRET, `${c.slice(0, 3)} ${c.slice(3)}`, now), null);
});
