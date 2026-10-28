import test from "node:test";
import assert from "node:assert/strict";
import { parseBrands } from "../../lib/brands.ts";
import { TEXT_BY_KEY, TEXT_DEFS, cleanText, textLines } from "../../lib/site-text-defs.ts";

test("brands: commas, new lines, duplicates and junk", () => {
  assert.deepEqual(parseBrands("Nike, Adidas\nPuma;  New  Balance ,, nike, !!!").map((b) => b.name), ["Nike", "Adidas", "Puma", "New Balance"]);
  assert.deepEqual(parseBrands("New Balance").map((b) => b.slug), ["new-balance"]);
  assert.equal(parseBrands("").length, 0);
  assert.equal(parseBrands("x".repeat(100))[0].name.length, 40);
});
test("site text keys are unique and every default is usable", () => {
  assert.equal(new Set(TEXT_DEFS.map((d) => d.key)).size, TEXT_DEFS.length);
  for (const d of TEXT_DEFS) assert.equal(cleanText(d, d.def), d.def.replace(/\r\n?/g, "\n").trim().slice(0, 4000), d.key);
});
test("toggles only ever become 1 or 0, text is capped, empty means original", () => {
  assert.equal(cleanText(TEXT_BY_KEY["show.faq"], "0"), "0");
  assert.equal(cleanText(TEXT_BY_KEY["show.faq"], "banana"), "1");
  assert.equal(cleanText(TEXT_BY_KEY["home.faq.title"], "a".repeat(500)).length, 200);
  assert.equal(cleanText(TEXT_BY_KEY["home.faq.title"], "  line\nbreak  "), "line break");
  assert.equal(cleanText(TEXT_BY_KEY["home.faq.title"], "   "), "");
  assert.deepEqual(textLines("a\n\n b \n"), ["a", "b"]);
});
test("gift steps default parses as Title | text", () => {
  for (const l of textLines(TEXT_BY_KEY["gift.steps"].def)) assert.ok(l.includes("|"), l);
});
