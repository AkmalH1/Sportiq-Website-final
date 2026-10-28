# SPORTIQ

Sportswear store for Sri Lanka: ready stock plus pre-orders, worldwide delivery, order tracking, PayHere and bank transfer, and an admin area with pre-order batch management.

## Run it

You need **Node.js 20.9 or newer** (`node -v`) and a **MySQL 8 / MariaDB** database. The easiest way is Docker: from this folder run `docker compose -f docker-compose.dev.yml up -d` (or use XAMPP/MySQL and create a database called `sportiq`).

```bash
cd frontend
npm install   # if you ran it before, first delete the node_modules and .next folders
cp .env.example .env.local      # Windows: copy .env.example .env.local
npm run dev                     # http://localhost:3000
```

The first start creates all tables in the `sportiq` database and fills the shop with starter FAQs, collections and (because `SEED_DEMO_DATA=true` in `.env.example`) **clearly marked demo products and banners**.
Staff area: http://localhost:3000/admin/login (local dev password: `sportiq-admin`).

## What is built

**Store**
- Homepage with parallax hero, campaign slider, sport cards (Football, NBA, NFL, NHL, Formula 1, Rugby, Baseball, Caps), approved customer reviews, FAQ.
- **Caps** page (`/caps`): shop by style (fitted, snapback, dad hats...), shop by league, filters and sorting.
- Product page: per-size availability ("3 in stock" / "Pre-order"), size chart button, gallery, reviews. If you ask for more than is in stock the order splits into ready stock plus pre-order.
- **Football jerseys**: long sleeves (+500), customisation name/number (+700, typed or attached image), up to 3 patches (300 / 200 / 100, typed or attached image). Prices editable in Admin > Settings.
- Pre-orders arrive in 2 to 3 weeks. Full payment is recommended; in Sri Lanka customers can pay half now and the balance in cash on delivery or at pickup.
- **Delivery**: Sri Lanka delivery LKR 500, store pickup free, worldwide postage calculated by country zone and parcel weight (`/shipping` has a calculator). Zone rates are editable in Admin > Shipping. **The starting rates are placeholder estimates. Replace them with your real rates.**
- Order tracking at `/track-order` (reference + email), stages adapt to delivery, pickup or international.
- Payments: PayHere (signed server callback) and bank transfer (staff verify), cash balance recorded by staff, store credit codes.
- About us page with live map, store photos and your story. Returns and exchanges page (exchange or store credit only, verified by admin on WhatsApp 0775379088). Floating WhatsApp button.
- Customer reviews with an optional photo, published only after you approve them.

**Admin** (`/admin`)
- Dashboard (money received, balances owed, supplier balances, orders by stage), orders with bulk "put in batch" and bulk stage change, CSV exports.
- **Pre-order batches**: group customers' pre-orders into a batch, move the whole batch through Supplier Paid, Production, Shipping, Arrived; customers' tracking pages update. Suppliers, supplier payments, expenses, profit estimate (ideas ported from your ERP).
- Customers, payments ledger, activity log, WhatsApp message for the current stage on each order.
- Products with sizes, size chart, gallery, customisable flag, weight; **bulk CSV import** and bulk photo upload (file name = product slug); banners.
- **FAQs and collections** (Admin > Content): add, edit, reorder and hide the homepage FAQs and collection pages.
- **Categories and subcategories**: add, rename, reorder, hide, set size charts. Site settings (contact, address, hours, About text, prices, top banner messages). Reviews moderation. Exchanges and store credit.

## Going live checklist

1. Fill `.env.local` (see `.env.example`): `DATABASE_URL`, `SITE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `BANK_*`, `PAYHERE_*`.
2. PayHere: use sandbox credentials first with `PAYHERE_MODE=sandbox`. PayHere must be able to reach `SITE_URL/api/payhere/notify`, so on your own computer use a tunnel (for example ngrok) and put its address in `SITE_URL`. Switch to `PAYHERE_MODE=live` only after PayHere approves your merchant account and you have done a sandbox test.
3. Replace the demo products: bulk import in Admin > Bulk import, then delete or archive the demo ones.
4. Set `SEED_DEMO_DATA=false` before first start on the production server so demo data is not created.
5. Back up the MySQL database (`backup.sh` does it with Docker) and `frontend/data/uploads` (uploaded images).
6. In Admin > Settings add your store address (the About page map uses it), opening hours, store photos and check the About story. In Admin > Shipping set real postage rates. Check the size charts.

## Not built yet

Customer accounts and wishlist, email notifications (order confirmations are on screen only), automatic refunds, separate staff logins (the admin uses one shared password), Sri Lanka Post live rates (postage uses your editable zone table).

## Hosting
See DEPLOY.md for the full step-by-step guide (Docker + automatic HTTPS + backups).

See PAYMENTS.md for payment rules, test results and the go-live checklist (card payments are not considered integrated until a provider sandbox test is done).

See SECURITY.md for the security design and the list of known limits.
