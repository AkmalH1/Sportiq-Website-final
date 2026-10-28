#!/usr/bin/env bash
# Proves a backup is usable WITHOUT touching the live database: restores the newest (or given) DB backup into a throwaway
# database, counts rows in key tables, then drops it. Run monthly:  ./restore-test.sh [backups/sportiq-db-DATE.sql.gz]
set -euo pipefail
cd "$(dirname "$0")"
FILE="${1:-$(ls -1t backups/sportiq-db-*.sql.gz backups/sportiq-db-*.sql.gz.gpg 2>/dev/null | head -1 || true)}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "No backup found. Run ./backup.sh first."; exit 1; }
SQL='mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
docker compose exec -T db sh -c "$SQL -e 'DROP DATABASE IF EXISTS sportiq_restore_test; CREATE DATABASE sportiq_restore_test CHARACTER SET utf8mb4'"
reader() { case "$FILE" in
  *.gpg) PASS="${BACKUP_PASSPHRASE:-$(grep -E '^BACKUP_PASSPHRASE=' .backup.env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')}"
         [ -n "$PASS" ] || { echo "Encrypted backup: set BACKUP_PASSPHRASE" >&2; exit 1; }
         gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$FILE" 3<<<"$PASS" | gunzip -c ;;
  *) gunzip -c "$FILE" ;; esac; }
reader | docker compose exec -T db sh -c "$SQL sportiq_restore_test"
docker compose exec -T db sh -c "$SQL -N -e 'SELECT \"orders\", COUNT(*) FROM sportiq_restore_test.orders UNION ALL SELECT \"payments\", COUNT(*) FROM sportiq_restore_test.payments UNION ALL SELECT \"products\", COUNT(*) FROM sportiq_restore_test.products'" || { echo "RESTORE CHECK FAILED"; exit 1; }
docker compose exec -T db sh -c "$SQL -e 'DROP DATABASE sportiq_restore_test'"
echo "OK: $FILE restored into a scratch database and read back. Live data was not touched."
