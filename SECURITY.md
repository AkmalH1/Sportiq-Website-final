# SPORTIQ security notes

## What is built in
- **Admin login**: one shared staff password, stored as an scrypt hash if you set `ADMIN_PASSWORD_HASH` (see DEPLOY.md). No default password in production: the site refuses admin login until you set one. Login is limited to 8 tries / 15 min per IP (saved in the database, survives restarts) and failures are written to the activity log. Session cookie is signed, HttpOnly, SameSite=Strict, Secure, 8 hours.
- **Every admin action and export checks the session on the server** (not just the page).
- **All prices are calculated on the server.** The browser cannot change prices, postage, add-on fees or store credit.
- **Payments**: PayHere callbacks must carry a valid signature, matching amount and currency; duplicates are ignored; a payment that arrives after an order was cancelled is NOT credited, stock is not touched, and the order is flagged "Late payment" for staff to refund. Bank transfers and cash are only counted when staff confirm.
- **Payments**: see PAYMENTS.md. Receipts are private, staff names are recorded on payment decisions, over-payments and mismatches go to a review queue, and gateway notifications are size- and rate-limited.
- **Stock**: reserved inside database transactions, so two buyers cannot take the last item; unpaid orders are released automatically every 5 minutes by a background job.
- **Customer privacy**: order links use a signed key, never the email address; order and payment pages are `no-store` / `no-referrer`; looking up an order is rate limited.
- **Uploads**: type is checked, then the image is decoded and re-encoded to WebP (max 1600px, metadata removed); 4 MB limit; rate limited.
- **Headers**: Content-Security-Policy, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. HTTPS is automatic through Caddy.
- **Input validation** on every form and server action; database queries are parameterised (no SQL built from user text).
- **Secrets** only come from environment variables (`.env` is git-ignored and excluded from the zip).

## Still your job / known limits
- Set strong `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`; keep `SEED_DEMO_DATA=false`.
- Everyone on the staff shares one login, so the activity log cannot tell staff apart. Separate staff accounts and roles are not built yet.
- No emails are sent automatically yet (customers use the tracking page and WhatsApp).
- Copy `backups/` off the server regularly and test a restore once.
- The database is MySQL with row-level locking, so the site can run several web servers against one database. Keep the database port closed to the internet (the bundled compose file does not publish it) and back it up (`backup.sh`).
- Real-device testing (Android Chrome, iPhone Safari) and a PayHere live test payment must be done by you; I tested with phone emulation and PayHere sandbox-style signed callbacks only.
- Review team names/logos for trademark risk with a lawyer; the disclaimer page is not legal advice.

## Added in the production-hardening passes
- **Atomic rate limiting**: every limiter (login, one-time-code replay, uploads, orders, lookups, reviews, payment notices) is a single `INSERT ... ON DUPLICATE KEY UPDATE` on a primary key, so concurrent requests cannot slip past a check-then-insert race. Tested with 200 simultaneous requests: exactly the allowed number pass; 50 simultaneous uses of one authenticator code: exactly one wins (`tests/unit/ratelimit.concurrency.mjs`). Fixed windows: up to 2x the limit can pass across a window boundary.
- **Mandatory two-factor in production**: admin cannot be logged into unless `ADMIN_PASSWORD_HASH`, a 32+ character `SESSION_SECRET` and `ADMIN_TOTP_SECRET` are set (plain `ADMIN_PASSWORD` is refused in production). Codes are single-use. (`ADMIN_MFA_OPTIONAL=true` is a test-server-only switch; never set it live.)
- **No lockout denial-of-service**: strangers are limited per address (8 / 15 min). A flood from many addresses never closes the login: it slows unknown browsers (up to 4 s per try) and alerts you. Your own browser carries a signed "known device" cookie (30 days, set only after password + code) and keeps normal speed. Tested (`e2e10.py`).
- **Independent payment verification** with PayHere's Retrieval API (see PAYMENTS.md section 7), mandatory in live mode.
- **Strict nonce-based CSP** (`proxy.ts`): no inline or eval scripts; injected event handlers are blocked (`csp.py`, real browser, 12 pages, cart and checkout still work). Styles still allow inline attributes.
- **Non-root container**: the entrypoint fixes ownership of the uploads volume, then runs the server as the unprivileged `node` user (privilege drop and chown of an old root-owned volume were tested locally; the Docker image itself could not be built in the review environment).
- **Database TLS guard**: in production a database host other than `db`/localhost is refused unless `DATABASE_SSL=true` (optional `DATABASE_SSL_CA`).
- **Dev password** works only when `SITE_URL` is localhost; the Windows/Mac quick-start now says "local test only".
- **Encrypted, off-site backups** (GnuPG AES-256 via `BACKUP_PASSPHRASE`, optional rclone upload, failure alert) and `restore-test.sh`; pipeline round-trip tested with a stand-in for Docker.
- **Supply chain**: Dependabot (npm, Docker, Actions), `npm audit` and a Trivy image scan in CI.
- **Phone alerts** (`ALERT_WEBHOOK_URL`) for heavy login guessing and failed backups; **upload ceiling** (400/hour overall, request-size pre-check).
- Logging out everywhere: change `SESSION_SECRET` and restart.

## Second review round (all checked against the code)
- **Web container no longer receives secrets it does not need**: `docker-compose.yml` passes an explicit list of variables; the database ROOT password and the backup passphrase are not among them. The passphrase lives in a separate `.backup.env` that only `backup.sh` reads. The database healthcheck no longer puts a password on a command line.
- **CSV formula injection**: the existing escaping already covered `=` and `@`, but not `+`/`-` followed by a digit (e.g. `+1+cmd|...`). Now every text cell starting with `=`, `@`, tab, CR, `+` or `-` is neutralised unless it is a plain number or phone number; real numbers are untouched (`tests/unit/csv.test.ts`, and an export test in `e2e9.py`).
- **Email in URLs**: after submitting a bank reference the redirect now always uses the signed order key, even if the customer arrived with a raw email (`e2e8.py`). Tracking and payment pages are rate limited per address (90 views / 10 min).
- **Store credit**: price checks are limited (240 / 10 min) and credit-code attempts much harder (12 / 15 min).
- **CDN / proxy**: `CLIENT_IP_HEADER` (e.g. `cf-connecting-ip`) is supported for sites behind Cloudflare; DEPLOY.md explains the firewall rule that makes it safe.
- **Upload cap**: the overall hourly cap is raised to 2,000 so one visitor cannot exhaust it; the per-address limit (15 / 10 min) is the real control.
- **`Cross-Origin-Opener-Policy: same-origin`** added.
- **PAYHERE_MODE**: in production it must be stated explicitly (`live` or `sandbox`); a missing value switches card payments off instead of defaulting to sandbox.
- Junk removed from the zip (`after.txt`, `tsconfig.tsbuildinfo`). `tests/e2e/receipt.png` stays: it is a 638-byte test fixture used by `e2e8.py`.

## Decisions I did NOT take, and why
- **`img-src https:` stays**: bulk import accepts external image URLs for products, so tightening it could blank catalogue images (catalogue is out of scope). It does not allow scripts.
- **Order links still do not expire**: customers reopen them from WhatsApp days later. They are unguessable (128-bit), no-store and no-referrer, and now rate limited. Expiring links would need a login or email step you do not have.
- **Store credit issued without an email works for anyone holding the code**: a business-policy choice; issue credits against an email if you want them bound.
- **Multi-stage Docker build**: not done. Next loads `next.config.ts` at start-up (needs TypeScript) and I cannot build or run the image here, so an untested change could break your deployment. Do it later with a staged test on the server.
- **Per-staff accounts / session revocation**: still shared login; rotate `SESSION_SECRET` to log everyone out.

## Still open / not verified here
- Image digests are not pinned (tags follow patch releases); DEPLOY.md explains how to pin on your server.
- Backups stay only on the server until you set `BACKUP_RCLONE_REMOTE`; keep the passphrase off the server.
- No transactional email yet (alerts use the webhook).
- Not verified in this environment: building/running the Docker image and Caddy, a real PayHere sandbox payment (verification was tested against a mock of PayHere's documented API), real phones. The Playwright suites e2e2-e2e10 and csp.py were run against MariaDB 10.11 (not MySQL 8.4); the SQL used is standard to both.

## Added in the third review pass
- **Tracking links expire**: the `t_...` order key now carries an expiry (90 days) inside its signature. A leaked or old link stops working; the customer looks the order up again with reference + email.
- **Page limit counts only failed lookups** (30 per 10 min per address) on the tracking and pay pages, so customers sharing one mobile connection are never blocked from viewing their own orders.

## Fourth review pass (F-01 .. F-11)
What changed and how it was checked. "Tested" = automated test run in this session; see frontend/tests/README.md.

- **F-01 Which host answers which path** (`lib/host-policy.ts`, used by `proxy.ts`, mirrored in the Caddyfile). Public host: everything except `/admin`. Staff host (`ADMIN_HOST`): only `/admin`, `/uploads`, `/api/health`; the customer upload and the PayHere callback do NOT exist there. Optional callback host (`PAYHERE_NOTIFY_HOST`): only `/api/payhere/notify` and `/api/health`, and then the public host stops answering the callback. Paths are lower-cased, decoded and slash-collapsed before judging. Two real holes closed: the proxy matcher used to exclude `/api` entirely, and a request with a `purpose: prefetch` header skipped the proxy completely.
- **F-02 / F-04 Upload limits.** Body bytes are counted on the stream before multipart parsing (`lib/request-guard.ts`; Content-Length is only an early hint). Public `/api/upload`: 5 MB body, 1 image, 4 parts, 3 at once (no queue, 503 + Retry-After), 30 s body deadline, existing 15/10 min per address and 2000/h global limits kept. `/admin/photos`: 24 MB body, 7 files, 12 parts, 3 at once + 8 queued, same-Origin check, 256 KB for its JSON calls. Images: 4 MB each, sharp `limitInputPixels` 40 MP, 20 s decode timeout, sharp threads = 2, small cache. Files are written to a temp name then renamed. Storage quota `STORAGE_QUOTA_MB` (default 10 GB): public uploads pause at 90 %, staff at 100 %, owner alert at 80 %. Events are logged without personal data (`[upload] ...`).
- **F-04 Retention.** `scripts/cleanup-uploads.mjs`: dry-run by default; `--apply` MOVES files to `data/trash/<date>/` (never deletes); only files that no text column of any table mentions, older than `--days` (30), plus stale temp files. Run monthly after checking the dry-run list.
- **F-03 MFA.** In production `ADMIN_MFA_OPTIONAL` is ignored (`mfaBypassAllowed`), setting it disables admin login AND stops the server starting. Only `NODE_ENV!=production` can use it.
- **F-05 Shared staff login: DOCUMENTED ONLY (plan), not migrated.** Today: one password + one authenticator secret, staff type their name (recorded in the audit log but not authenticated). Moving to individual accounts needs a new `staff_users` table (schema/migration, outside this pass) and changes every login. Rollout plan: (1) add `staff_users(id, name, role, password_hash, totp_secret, active, created_at)` and `staff_sessions(id, user_id, token_hash, expires_at, revoked_at)`; (2) ship login that accepts BOTH the old shared login and personal accounts, shared login restricted to role "owner"; (3) owner creates accounts for each person (roles: owner = everything, manager = orders/payments/products, packer = orders stage only), each with its own authenticator; (4) check the audit log shows personal names for a week; (5) disable the shared login by removing `ADMIN_PASSWORD_HASH`; (6) revocation = set `active=0` / `revoked_at`, effective on the next request because sessions are looked up server-side. Recovery: keep the shared secrets (hash + TOTP) in a sealed offline note; if the only owner loses the authenticator, set a new `ADMIN_TOTP_SECRET` via `.env` and restart. Until then: rotate `SESSION_SECRET` and the password when anyone leaves.
- **F-06 Redirects/CSRF.** `assignOrdersAction` and `bulkStageAction` take `back` only through `safeAdminPath` (internal `/admin...` page pattern; anything else becomes `/admin`). Every action in `ops-actions.ts` calls `requireAdmin()` first (via `run()`); Next compares Origin to Host for server actions and the cookie is SameSite=Strict. `/admin/photos` (a plain route) got its own Origin check.
- **F-07 Payments.** Decision rules extracted to `lib/payhere-logic.ts` and used by `lib/orders.ts` and the callback. Fixed: a replayed "paid" notice after a chargeback could credit the order a second time (chargeback is now final). Callback body is capped on the stream (4 KB); a payment id reused on another payment (UNIQUE `payments_provider_ref`) is refused, logged, flagged for staff and answered 409 instead of a silent 200; delayed failure after success is logged as ignored. Throttled alerts for bad signature, amount mismatch, unconfirmed payment, retrieval outage, chargeback, reused id.
- **F-08 Reliability.** DB pool: bounded wait queue, connect timeout, keep-alive, idle trim, `DB_POOL_SIZE` validated; DB start-up failure and health-check failure are logged and alerted (throttled); housekeeping failures alert; storage growth monitored (80 % alert). Interrupted image writes cannot leave half files. Backups/restore: see DEPLOY.md "Backups and restore".
- **F-09 Request size limits (per layer).** Public host: Caddy 8 MB, `/api/upload` 5 MB, callback 16 KB. Staff host: Caddy 26 MB. App: import file 20 MB, photo request 24 MB, image 4 MB, server actions 25 MB (not a public limit: Caddy caps public traffic at 8 MB). The staff cap used to be 8 MB, below the importer's own 20 MB limit.
- **F-10 Client address.** Forwarded headers are believed only when the request carries `X-Proxy-Auth` equal to `PROXY_AUTH_SECRET` (Caddy adds it and sets `X-Real-Client-IP` from its own verified `{client_ip}`); otherwise the visitor is keyed "direct". Cloudflare: use Caddy `trusted_proxies` (commented in Caddyfile). Without the secret the old behaviour remains and `check-env` warns (error if `CLIENT_IP_HEADER` is set).
- **F-11 Config check.** `lib/env-check.ts`; runs at start-up (production: exits with the variable names, never values) and as `node --experimental-strip-types scripts/check-env.mjs --env-file .env --production`.
