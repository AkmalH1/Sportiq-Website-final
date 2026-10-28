import test from "node:test";
import assert from "node:assert/strict";
import { convertScraperx, photoPlan, type ScraperxOptions } from "../../lib/scraperx.ts";

const opt: ScraperxOptions = { markupPct: 20, sport: "football", status: "draft", preorder: true, preorderEta: "2 weeks" };
const head1 = ["Product Name", "SKU", "Cost Price", "Sell Price", "Description", "Category", "Main Image — Full Path", "Gallery Images — Full Paths"];
const head2 = [...head1.slice(0, 6), "Sizes", ...head1.slice(6)];

test("merges price from one sheet with sizes from another, cleans name, makes unique slugs", () => {
  const r = convertScraperx(
    [
      { name: "All", rows: [head1, ["Buy AC Milan Away Retro Jersey customizable", "TOF1", 1000, 0, "short", "Retro", "C:\\a\\x_0.jpg", "C:\\a\\x_1.png | C:\\a\\x_2.webp"], ["AC Milan Away Retro Jersey", "TOF2", 1000, 0, "", "Retro", "", ""]] },
      { name: "Cat", rows: [head2, ["Buy AC Milan Away Retro Jersey customizable", "TOF1", 0, 0, "short", "Retro", "Large | Xtra Large | Weird", "", ""]] },
    ],
    opt,
  );
  assert.deepEqual(r.errors, []);
  const h = r.rows[0];
  const row = (i: number) => Object.fromEntries(h.map((k, j) => [k, r.rows[i][j]]));
  assert.equal(r.rows.length, 3);
  assert.equal(row(1).slug, "ac-milan-away-retro-jersey");
  assert.equal(row(1).customizable, "yes");
  assert.equal(row(1).price_lkr, "1200"); // 1000 + 20%
  assert.equal(row(1).status, "draft");
  assert.equal(row(1).stock_M, ""); // blank = leave stock alone
  assert.equal(row(2).slug, "ac-milan-away-retro-jersey-tof2"); // collision gets the SKU
  assert.equal(r.photos[0].target, "ac-milan-away-retro-jersey.jpg");
  assert.equal(r.photos[1].target, "ac-milan-away-retro-jersey-2.png");
  assert.ok(r.notes.some((n) => n.includes("Weird")));
});

test("rows without any price are rejected, not imported at 0", () => {
  const r = convertScraperx([{ name: "x", rows: [head1, ["Thing", "TOF9", 0, 0, "", "", "", ""]] }], opt);
  assert.equal(r.rows.length, 0);
  assert.match(r.errors[0].message, /no price/);
});

test("photo plan keeps folder/file from Windows paths, in order", () => {
  const plan = photoPlan([
    { slug: "a", source: "C:\\Users\\x\\images\\milan\\a_0.jpg", target: "a.jpg" },
    { slug: "a", source: "C:\\Users\\x\\images\\milan\\a_1.webp", target: "a-2.webp" },
  ]);
  assert.deepEqual(plan, [{ slug: "a", files: ["milan/a_0.jpg", "milan/a_1.webp"] }]);
});

test("blank SKU gets a stable generated prefix and still merges across sheets", () => {
  const a = convertScraperx([{ name: "A", rows: [head1, ["1988 Germany Home retro kit", null, 4900, 0, "", "Uncategorized", "", ""]] }, { name: "B", rows: [head2, ["1988 Germany Home retro kit", null, 0, 0, "", "Uncategorized", "S | M", "", ""]] }], opt);
  const b = convertScraperx([{ name: "A", rows: [head1, ["1988 Germany Home retro kit", null, 4900, 0, "", "Uncategorized", "", ""]] }], opt);
  assert.deepEqual(a.errors, []);
  assert.equal(a.rows.length, 2);
  const i = a.rows[0].indexOf("sku_prefix");
  assert.match(a.rows[1][i], /^SIQ-[A-Z0-9]{7}$/);
  assert.equal(a.rows[1][i], b.rows[1][i]); // same name, same SKU every time
});
