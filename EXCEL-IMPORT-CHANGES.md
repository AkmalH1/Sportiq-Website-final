# Excel import patch

Admin > Bulk product import now accepts .xlsx as well as .csv.

Two workbook types are understood:
- SPORTIQ template (has a `slug` column), same columns as the CSV template.
- ScraperX export (has `Product Name` and `SKU`). Sheets are merged by SKU, names cleaned (leading "Buy", trailing "customizable"), slugs generated, sizes read, prices taken from Sell Price or Cost Price + markup %.

Workflow: choose file > "Check file" (preview, nothing saved) > "Import". All-or-nothing in one transaction.

One-click photos: choose the Excel AND the "Photos folder" (the folder that holds the images). After "Import" the browser matches each product's image paths from the Excel (last folder + file name) against the chosen folder, shrinks each photo to max 1600px, and uploads them 4 at a time through the new admin-only route /admin/photos (each file is re-encoded by the server). Products that already have a photo are skipped, so a stopped run can be repeated. Limits raised to 10,000 rows / 20 MB. Max 5 photos per product (main + 4).

Local image paths (C:\\...\\shirt_0.png) in the image_url column are no longer saved as text (browsers cannot show them). They become photos to upload from the chosen Photos folder; name_1, name_2... files next to name_0 become the gallery. Old bad values are cleared on the next import. league "no" now means empty.

Subcategories missing from the site (e.g. "retro") are created automatically when the "Create new subcategories automatically" box is ticked (default on); otherwise the import stops with the row error.

Behaviour changes to the existing importer (also apply to CSV):
- Blank description, type, version, pre-order estimate, image and stock cells keep the saved value (previously they overwrote it; blank stock meant 0).
- The same sku_prefix on two different products in one file is now an error.
- SKUs owned by another product are reported during the check, not only at commit.

- Also repairs workbooks with empty "inline string" cells (ScraperX), and generates SKUs (SIQ-xxxxxxx) when the sheet has none.

Files: app/admin/photos/route.ts (new); lib/scraperx.ts, lib/import-headers.ts, lib/xlsx-read.ts (new); fflate 0.7.5 added; lib/import.ts, app/admin/actions.ts, app/admin/import/ImportForm.tsx, app/admin/import/page.tsx, next.config.ts, tsconfig.json, package.json, package-lock.json (changed); tests/unit/scraperx.test.ts (new).
New dependency: read-excel-file 5.8.8 (npm audit: 0 vulnerabilities). No database migration needed.
Rollback: restore the previous versions of the files above and `npm uninstall read-excel-file`.
