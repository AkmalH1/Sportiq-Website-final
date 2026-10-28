#!/usr/bin/env bash
# Daily backup of the database (mysqldump) and uploaded photos (incl. private payment receipts). Cron:  0 3 * * * /opt/sportiq/backup.sh
# Optional settings in .env:
#   BACKUP_PASSPHRASE   -> backups are encrypted (GnuPG AES-256) before they are stored or uploaded. KEEP THIS PASSPHRASE SAFE OFF THE SERVER:
#                          without it the backups cannot be restored.
#   BACKUP_RCLONE_REMOTE -> copy the (encrypted) files off the server with rclone, e.g. "b2:sportiq-backups" or "gdrive:sportiq" (set up once with `rclone config`)
#   ALERT_WEBHOOK_URL   -> get a phone message if a backup fails
set -euo pipefail
cd "$(dirname "$0")"
umask 077
mkdir -p backups
# Backup settings live in .backup.env (chmod 600), NOT in .env: the web container never sees them, so a compromised website cannot read the passphrase.
envval() { for f in .backup.env .env; do [ -f "$f" ] && grep -E "^$1=" "$f" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' && return 0; done; return 0; }
PASS="${BACKUP_PASSPHRASE:-$(envval BACKUP_PASSPHRASE)}"
REMOTE="${BACKUP_RCLONE_REMOTE:-$(envval BACKUP_RCLONE_REMOTE)}"
HOOK="${ALERT_WEBHOOK_URL:-$(envval ALERT_WEBHOOK_URL)}"
fail() { echo "BACKUP FAILED: $1" >&2; [ -n "$HOOK" ] && curl -fsS -m 8 -H 'Content-Type: application/json' -d "{\"text\":\"[SPORTIQ] BACKUP FAILED: $1\",\"content\":\"[SPORTIQ] BACKUP FAILED: $1\"}" "$HOOK" >/dev/null 2>&1 || true; exit 1; }
trap 'fail "step failed near line $LINENO"' ERR
STAMP=$(date +%Y%m%d-%H%M)
DB="backups/sportiq-db-$STAMP.sql.gz"; FILES="backups/sportiq-files-$STAMP.tar.gz"
docker compose exec -T db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --default-character-set=utf8mb4 sportiq' | gzip > "$DB"
docker compose run --rm --no-deps -T -v "$PWD/backups:/backup" --entrypoint sh web -c "tar czf /backup/sportiq-files-$STAMP.tar.gz -C /app data"
[ -s "$DB" ] && gzip -t "$DB" || fail "database dump is empty or corrupt"
tar tzf "$FILES" >/dev/null || fail "files archive is corrupt"
OUT=("$DB" "$FILES")
if [ -n "$PASS" ]; then
  for f in "$DB" "$FILES"; do
    gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 -o "$f.gpg" "$f" 3<<<"$PASS"
    shred -u "$f" 2>/dev/null || rm -f "$f"
  done
  OUT=("$DB.gpg" "$FILES.gpg")
else
  echo "WARNING: BACKUP_PASSPHRASE is not set, so these backups are NOT encrypted. They contain customer data." >&2
fi
if [ -n "$REMOTE" ]; then
  command -v rclone >/dev/null || fail "BACKUP_RCLONE_REMOTE is set but rclone is not installed"
  rclone copy --immutable "${OUT[@]}" "$REMOTE" || fail "upload to $REMOTE failed"
  echo "Uploaded to $REMOTE"
else
  echo "NOTE: no BACKUP_RCLONE_REMOTE set: backups are only on this server. Copy them elsewhere, or a disk failure loses everything."
fi
find backups -name 'sportiq-*' -mtime +30 -delete
echo "Backup saved: ${OUT[*]}"
