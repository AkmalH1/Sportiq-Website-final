# SportiQ launch polish: implementation report

Everything below was run on a throwaway local MariaDB with fake data, never on live data. The pristine original is in the zip you sent.

## What changed for customers
- **Product cards**: names clamp to 2 lines, type/price pinned to the bottom, available sizes shown, so rows line up on every page. Tighter spacing on phones.
- **Sport pages** (`/sports/<sport>`): compact header with original line art; a large, auto-scrolling logo row ("Top Leagues" for football, "Top Teams" for F1/NBA/NFL/NHL/baseball, "Top Competitions" for rugby) with dash page indicators; product-type chips; Filters drawer (availability, size, price; bottom sheet on phones); sort; removable filter chips; result count; empty state with reset. Filtering is instant in the browser, and the URL (`?comp=la-liga`) can be shared; the server renders the same filtered result for search engines.
- **Homepage**: sport tiles and campaign slides use original line artwork (no crests, logos, kits or photography).
- One shared component serves every sport. The row shows only competitions that have at least one published product.

## Owner actions needed (data, not code)
1. **Tag products**: the catalogue had no league/team data, and names are not guessed. Add a `competition` column to your import file (or use the product form). Blank cells leave existing values alone. "Create new subcategories automatically" also creates new competitions.
2. **Add logos**: Admin > Categories > Competitions has a logo link per competition (`https://` or `/uploads/...`). Official logos could not be downloaded or verified from this environment, so none are included; until you add one the row shows initials and the name. Use only logos you are entitled to use.

## Database
Migration 5 (additive, runs automatically): `competitions` table and `products.competition_slug`. No existing row is changed.

## Security (F-01 to F-11)
See SECURITY.md and DEPLOY.md. F-01, F-02, F-03, F-04, F-06, F-07, F-10, F-11 implemented and unit-tested; F-08, F-09 implemented, partly tested; F-05 is a documented rollout plan only (replacing the shared staff login needs a schema change and a recovery plan).
Also: **Next.js upgraded 16.4.0 to 16.4.3** (patch release). 16.4.0 has critical advisories (image-optimisation RCE, `use cache` RCE, server-action DoS) and its own build refused to finish. `npm audit` now reports 0 vulnerabilities.

## Verification actually run
- Unit tests 51/51. Payment race test against the test DB passes (30 simultaneous callbacks credit once; replay after chargeback credits nothing; duplicate payment id rejected).
- `tsc --noEmit` clean. ESLint 0 errors (1 pre-existing warning). `next build` succeeds.
- Real browser (Chromium) against the production build: league filter, combined filters, empty state, reset, deep link, bad URL values, drawer, auto-scroll and dots at 390 and 1280 px; no console errors; no horizontal overflow on home, sports, shop, caps and search at 360/390/768/1280.

## NOT verified
- Real catalogue data and real logos (test data used generic shapes).
- Caddyfile (no Caddy here), Docker, real PayHere sandbox, Retrieval-API outage end to end, bulk import and multi-photo upload end to end, `cleanup-uploads --apply`, alerts firing live.
- The Python e2e suite (changed to log in with two-factor) was only compile-checked.
- Header, cart, checkout and product-detail pages were not redesigned, only overflow-checked.
- The section 6 shopping-experience audit (checkout copy, tracking, etc.) was not done as a separate pass.

## Added in the second round (vouchers, gift cards, subgroups, editable text, new hero)

### How the owner uses it
- **Voucher codes** (Admin > Vouchers and gift cards): percent or fixed amount, minimum order, max discount, start/end dates, total uses, uses per email. Applies to products only, never postage. Customers type the code at checkout. A cancelled unpaid order frees its use. The per-email limit is checked when the order is placed (the email is not known earlier).
- **Gift cards** (/gift-cards, linked in the menu, footer and homepage): customer picks an amount and pays LESS than the card is worth (default tiers 5,000 = 5% off, 10,000 = 8%, 25,000 = 10%; change in Admin > Settings, along with validity months). The card is created only when the payment is confirmed, exactly once, and the code appears on the order page with a WhatsApp share link. It can be spent over several orders, with the balance kept, and combined with a voucher. Expired cards are refused; a chargeback voids the card.
- **Subgroups and brands** (Admin > Categories): under each subcategory open "Subgroups and brands", add a subgroup (e.g. Club kits) and type its brands (one per line or comma separated). Assign products on the product page (three dropdowns: subcategory, subgroup, brand) or with the `subgroup` and `brand` columns in the bulk import. On the sport page: type chips, then the subgroups of the chosen type, then that subgroup's brands. A subgroup shows once it has a published product; brands without products are listed but greyed out.
- **Site text** (Admin > Site text): edit the homepage, footer and gift cards wording, and switch homepage sections on or off. Clearing a box restores the original wording.
- **Premium hero**: every active "hero" banner is a slide (photo, headline, text, button), crossfading with dots, plus a scrolling highlights strip. Add several banners in Admin > Banners, each with its own photo.

### What was verified here (real browser against a throwaway database)
- Vouchers: percent discount stored correctly, per-email limit, max uses, minimum spend, expiry, unknown code, cancel releases the use, duplicate code rejected.
- Gift cards: priced 10,000 to 9,200, no card before payment, admin confirmation issues one card, code shown, partial spend leaves 5,100, ledger correct, expired card refused, mobile and desktop without overflow.
- Subgroups/brands: created in Admin, assigned through the product form, shown and filtered on desktop and phone, deep links, bad links ignored, delete blocked while products use it.
- Site text: edits appear, toggles hide sections, blank restores the original.
- 63 unit tests, type-check, lint (0 errors) and production build pass.

### NOT done or NOT verified
- **Official player photos are not included.** They need a licence, and none could be downloaded here. The hero is built so the owner uploads photos they are licensed to use (Admin > Banners). Until then the original 3D artwork shows.
- No email is sent for gift cards; the buyer copies the code or shares it on WhatsApp.
- Online card payment for gift cards (PayHere) was not tested; bank transfer was.
- Half-payment (deposit) with a voucher on pre-order items is covered by unit tests of the maths but was not placed through the browser.
- Bulk import with the new `subgroup`/`brand` columns was code-reviewed and type-checked, not run on a real file.
- Migrations 6 and 7 run automatically and are additive; back up the live database first.

## Launch checklist
1. Back up the live DB (`backup.sh`); deploy to staging first.
2. Run `node frontend/scripts/check-env.mjs --production` with the real environment. Production now refuses to start with weak secrets, missing `ADMIN_HOST`/TOTP, non-https `SITE_URL`, or `ADMIN_MFA_OPTIONAL` set.
3. `docker-compose.yml`: add `PROXY_AUTH_SECRET`, `PAYHERE_NOTIFY_HOST`, `STORAGE_QUOTA_MB` to `web`, and `PROXY_AUTH_SECRET` to `caddy`. Run `caddy validate`.
4. CI (`.github/workflows/ci.yml`): replace `ADMIN_MFA_OPTIONAL=true` with `SPORTIQ_E2E=1 ADMIN_TOTP_SECRET=...` (see SECURITY.md). `SPORTIQ_E2E=1` is a test-only startup bypass that only works when `SITE_URL` is localhost; never set it on the live server.
5. Tag products with competitions, add logos, check each sport page on a phone.
6. Place a test order and a PayHere sandbox payment before going live.
