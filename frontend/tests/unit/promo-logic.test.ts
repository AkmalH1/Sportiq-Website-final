import test from "node:test";
import assert from "node:assert/strict";
import { giftPrice, normalizeCode, parseTiers, splitDiscount, voucherDiscount } from "../../lib/promo-logic.ts";

const pct = { kind: "percent" as const, value: 10, minSpend: 0, maxDiscount: 0 };
test("percent voucher rounds down and respects the cap", () => {
  assert.equal(voucherDiscount(pct, 4999), 499);
  assert.equal(voucherDiscount({ ...pct, maxDiscount: 300 }, 4999), 300);
});
test("fixed voucher never exceeds the subtotal", () => {
  assert.equal(voucherDiscount({ kind: "fixed", value: 1500, minSpend: 0, maxDiscount: 0 }, 1000), 1000);
  assert.equal(voucherDiscount({ kind: "fixed", value: 1500, minSpend: 0, maxDiscount: 0 }, 6000), 1500);
});
test("minimum spend is enforced and bad input gives zero", () => {
  assert.equal(voucherDiscount({ ...pct, minSpend: 5000 }, 4999), 0);
  assert.equal(voucherDiscount({ ...pct, minSpend: 5000 }, 5000), 500);
  assert.equal(voucherDiscount(pct, 0), 0);
  assert.equal(voucherDiscount(pct, NaN), 0);
});
test("discount split always adds up and never exceeds each part", () => {
  for (const [d, r, p] of [[500, 3000, 2000], [1, 1, 1], [999, 0, 999], [999, 999, 0], [7, 5, 5], [2500, 1000, 1500]] as const) {
    const s = splitDiscount(d, r, p);
    assert.equal(s.ready + s.pre, Math.min(d, r + p), `${d} ${r} ${p}`);
    assert.ok(s.ready <= r && s.pre <= p && s.ready >= 0 && s.pre >= 0);
  }
  assert.deepEqual(splitDiscount(0, 100, 100), { ready: 0, pre: 0 });
});
test("gift tiers parse safely and price correctly", () => {
  const t = parseTiers("10000:8, 5000:5, junk, 25000:10, 5000:9, 100:5, 30000:99");
  assert.deepEqual(t.map((x) => x.face), [5000, 10000, 25000]);
  assert.deepEqual(giftPrice(10000, t), { face: 10000, percent: 8, price: 9200, saving: 800 });
  assert.equal(giftPrice(7500, t)?.percent, 5); // custom amount gets the best tier below it
  assert.equal(giftPrice(2000, t)?.price, 2000); // below the first tier: no discount
  assert.equal(giftPrice(1999, t), null);
  assert.equal(giftPrice(100001, t), null);
  assert.equal(giftPrice(5000.5, t), null);
});
test("codes ignore case and spaces", () => {
  assert.equal(normalizeCode("  welcome 10 "), "WELCOME10");
  assert.equal(normalizeCode(null), "");
});
