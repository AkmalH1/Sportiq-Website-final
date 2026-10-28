import test from "node:test";
import assert from "node:assert/strict";
import { csvEsc, parseCsv } from "../../lib/csv.ts";

test("formula starters in text are neutralised", () => {
  for (const evil of ["=HYPERLINK(\"http://x\")", "@SUM(A1)", "+1+cmd|' /C calc'!A0", "-2+3+cmd|' /C calc'!A0", "\t=1+1", "\r=1+1", "-cmd|x", "+cmd|x"]) {
    assert.ok(csvEsc(evil).replace(/^"/, "").startsWith("'"), `not neutralised: ${evil}`);
  }
});
test("normal data is left alone", () => {
  assert.equal(csvEsc("+94771234567"), "+94771234567"); // phone number
  assert.equal(csvEsc("077 123 4567"), "077 123 4567");
  assert.equal(csvEsc(-500), "-500");                    // real negative number (refund/expense)
  assert.equal(csvEsc(1250), "1250");
  assert.equal(csvEsc("Nimal Perera"), "Nimal Perera");
  assert.equal(csvEsc(null), "");
});
test("quotes, commas and newlines are quoted", () => {
  assert.equal(csvEsc('He said "hi", ok'), '"He said ""hi"", ok"');
  assert.equal(csvEsc("a\nb"), '"a\nb"');
});
test("an evil name survives a round trip as inert text", () => {
  const cell = csvEsc("=HYPERLINK(\"http://evil\",\"x\")");
  const [[back]] = parseCsv(cell + "\n");
  assert.ok(back.startsWith("'="));
});
