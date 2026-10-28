# Putting SPORTIQ on the internet

SPORTIQ keeps orders and customers in a **MySQL database** and uploaded photos on disk, so it needs a server with a **permanent disk** (the Docker setup below includes MySQL for you).
Use a small VPS (about US$5–6/month): DigitalOcean, Hetzner, Vultr or Linode, Ubuntu 22.04/24.04, 1 GB RAM is enough.
**Do not use Vercel/Netlify** — they wipe files, so orders would disappear.

## What you need
1. A VPS (Ubuntu) and its IP address.
2. A domain name (e.g. sportiq.lk). In your domain's DNS add an **A record** for `@` and for `www` pointing to the VPS IP.

## Steps
1. Connect: `ssh root@YOUR_SERVER_IP`
2. Install Docker (one time): `curl -fsSL https://get.docker.com | sh`
3. Upload this folder to the server, e.g. `scp SPORTIQ.zip root@YOUR_SERVER_IP:/opt/` then
   `apt install -y unzip && cd /opt && unzip SPORTIQ.zip -d sportiq && cd sportiq`
4. `cp .env.production.example .env` then `nano .env` and fill in: DOMAIN, SITE_URL, **DB_ROOT_PASSWORD**, **DB_PASSWORD**, **ADMIN_PASSWORD_HASH**, **ADMIN_TOTP_SECRET**, **SESSION_SECRET** (32+ characters),  BANK_* and (optionally) PAYHERE_*.
   Make a secret with: `openssl rand -hex 24`
5. Start it: `docker compose up -d --build` (first build takes a few minutes).
6. Open `https://yourdomain` — the HTTPS certificate is created automatically.
7. Open `https://staff.yourdomain` (the ADMIN_HOST you set; add a DNS record for it first. `/admin` no longer works on the public shop address), log in with your password and the 6-digit code from your authenticator app.

## Admin password and two-factor login (required in production)
Admin stays disabled until all of these are set in `.env`: `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` (32+ chars) and `ADMIN_TOTP_SECRET`.
1. Hash: `docker compose run --rm --no-deps web node scripts/hash-password.mjs "your long password (12+ characters)"` and paste the output as `ADMIN_PASSWORD_HASH`.
2. Two-factor: `docker compose run --rm --no-deps web node scripts/totp-setup.mjs`. Paste the `ADMIN_TOTP_SECRET=` line into `.env`, then add the secret to an authenticator app (Google Authenticator, Authy, 1Password...) by typing it or opening the `otpauth://` link as a QR code.
3. Restart: `docker compose up -d`. Test login in a private window BEFORE closing your SSH session.
**Recovery if you lose your phone or password:** you still own the server. SSH in, run step 1 or 2 again, replace the value in `.env`, `docker compose up -d`. Keep a copy of the TOTP secret and the backup passphrase in a password manager (not on the server). Changing `SESSION_SECRET` logs every device out (use it if you suspect a stolen session).
**Login protection:** 8 tries per address / 15 min; a flood from many addresses never closes the form, it only slows strangers down and sends you an alert (set `ALERT_WEBHOOK_URL`). Your own browser is remembered for 30 days after a full login and keeps normal speed.

## Card payments (PayHere) go-live
Besides the merchant ID and secret, live mode needs `PAYHERE_APP_ID` and `PAYHERE_APP_SECRET` (PayHere Business App, your domain allow-listed). Every "paid" notification is then double-checked against PayHere's Retrieval API before an order is marked paid. If PayHere cannot be reached the payment is retried automatically for 24 hours; a payment PayHere does not confirm appears in Admin > Payments as `unverified_payment`. Without these two values, live card payments stay switched off. Details: PAYMENTS.md.

## First things to do in /admin
- **Settings**: store address, phone, photos, trio brothers' names/text, disclaimer, size-chart default.
- **EMS rates**: type in real rates from Sri Lanka Post's EMS calculator for the countries you ship to.
- **Shipping**: check the fallback zone prices.
- **Categories**: each subcategory already has its own size chart — check the numbers against your real stock.
- **Products / Import**: add your products (CSV bulk upload available).
- PayHere: in your PayHere account set the notify URL to `https://yourdomain/api/payhere/notify` and the domain to your site.

## Everyday commands (run in /opt/sportiq)
- Logs: `docker compose logs -f web`
- Update after changing files: `docker compose up -d --build`
- Restart: `docker compose restart`
- **Backup** (database + photos + private receipts): `./backup.sh`. Create `.backup.env` from `.backup.env.example` (`chmod 600`); it is separate from `.env` so the website container never sees it. With `BACKUP_PASSPHRASE` set there the files are encrypted (`*.gpg`); with `BACKUP_RCLONE_REMOTE` set they are copied off the server (install rclone, run `rclone config` once). A failed backup alerts you if `ALERT_WEBHOOK_URL` is set. Daily cron: `crontab -e` → `0 3 * * * /opt/sportiq/backup.sh`.
- **Prove backups work (monthly):** `./restore-test.sh` restores the newest backup into a scratch database, reads it back and deletes it. Live data is untouched.
- To restore an encrypted backup for real: `gpg -d backups/FILE.gpg > FILE` (asks for the passphrase), then use the restore commands below on the decrypted file.
- Restore the database: `docker compose up -d db`, then
  `gunzip -c backups/sportiq-db-DATE.sql.gz | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" sportiq'`
- Restore the photos: `docker compose run --rm -T -v "$PWD/backups:/backup" --entrypoint sh web -c "tar xzf /backup/sportiq-files-DATE.tar.gz -C /app"`
- Tables are created and upgraded automatically each time the site starts (versioned migrations), so updating is just `docker compose up -d --build`.
- Everything the shop shows (FAQs, collections, categories, sizes charts, prices, shipping, banners, About text) is edited in /admin, not in code.

## Without Docker (alternative)
Node 20.9+ and a MySQL 8 / MariaDB 10.6+ database required: create an empty database and user, set `DATABASE_URL=mysql://user:password@host:3306/sportiq` plus the other variables from `.env.production.example`, then `cd frontend && npm ci && npm run build && npm start` behind any HTTPS reverse proxy (Caddy/nginx). Keep `frontend/data/uploads` on a persistent disk and back up both it and the database.

## Updates and image safety
`.github/dependabot.yml` opens weekly pull requests for npm, Docker base image and GitHub Actions updates, and CI scans the built image with Trivy and runs `npm audit`. Image tags (`mysql:8.4`, `caddy:2`, `node:22-slim`) follow security patches within their line; to pin an exact build, run `docker buildx imagetools inspect mysql:8.4` and replace the tag with `mysql:8.4@sha256:...` (do this on your server, then update deliberately). Before any update: `./backup.sh`; to roll back, restore the previous folder/image and, if the database changed, the pre-update backup.

## Security checklist
- Set ADMIN_PASSWORD_HASH, ADMIN_TOTP_SECRET and SESSION_SECRET. See SECURITY.md.
- Do a test payment in PayHere sandbox first (PAYHERE_MODE=sandbox), then switch to live.
- Copy backups off the server (another cloud drive or machine).
- Keep `SEED_DEMO_DATA=false`.
- Firewall: only ports 22, 80, 443 (`ufw allow 22,80,443/tcp && ufw enable`).

## Behind Cloudflare or another CDN
By default the visitor address is the last `X-Forwarded-For` entry, which is correct with Caddy directly on the internet. With a CDN in front, set `CLIENT_IP_HEADER=cf-connecting-ip` in `.env` AND firewall ports 80/443 so only the CDN's address ranges can reach the server; otherwise anyone could forge the header and dodge the rate limits.

## Before every deploy: check the configuration
`cd frontend && node --experimental-strip-types scripts/check-env.mjs --env-file ../.env --production` (FAIL lines must be fixed; the server also refuses to start with them). It names variables, never prints values.

## Trusted proxy (visitor address for rate limits)
Add the same random 32+ character `PROXY_AUTH_SECRET=` to `.env` and pass it to BOTH containers (`web` and `caddy` in docker-compose.yml: `PROXY_AUTH_SECRET: ${PROXY_AUTH_SECRET:-}`; also `PAYHERE_NOTIFY_HOST`, `STORAGE_QUOTA_MB` if used). Do not publish port 3000. Behind Cloudflare enable the `trusted_proxies` block in the Caddyfile instead of `CLIENT_IP_HEADER`. Check: `curl -H 'X-Forwarded-For: 1.2.3.4' http://web:3000/api/health` from inside the network is treated as "direct".

## Backups and restore
Daily `backup.sh` (DB dump + the whole data volume, encrypted) is already in place; keep `BACKUP_RCLONE_REMOTE` set so copies leave the server. Restore drill (quarterly): `bash restore-test.sh` restores the newest backup into a scratch database and checks it; real restore = stop `web`, `gunzip -c sportiq-db-*.sql.gz | docker compose exec -T db mysql -uroot -p sportiq`, extract the files archive into the `sportiq-uploads` volume, start `web`. After an interrupted import/upload nothing needs repair (temp files are ignored; `cleanup-uploads.mjs` removes stale ones); unpaid orders and unverified payments are re-processed by housekeeping automatically.

## Photo storage
Watch the "storage at N %" alert (80 %). Then run `docker compose exec web node --experimental-strip-types scripts/cleanup-uploads.mjs` (dry-run), review, add `--apply`. Raise the volume or `STORAGE_QUOTA_MB` if the shop really grew.

## Caddy changes in this version
New Caddyfile: per-path body limits, staff host cannot reach /api (except health), `X-Proxy-Auth`/`X-Real-Client-IP` upstream headers. Validate before reloading: `docker run --rm -v $PWD/Caddyfile:/etc/caddy/Caddyfile caddy:2 caddy validate --config /etc/caddy/Caddyfile` (needs DOMAIN/ADMIN_HOST env). NOT validated in this session (no Caddy available).
