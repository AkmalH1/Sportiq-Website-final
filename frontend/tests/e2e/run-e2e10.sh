#!/usr/bin/env bash
# Usage (from frontend/): DATABASE_URL=... bash tests/e2e/run-e2e10.sh   (fresh database; needs a production build)
set -euo pipefail
export ADMIN_PASSWORD_HASH="$(node scripts/hash-password.mjs test-password-12345)" SESSION_SECRET=testsecret1234567890-abcdefghijklmnop \
  SITE_URL=http://localhost:3080 ADMIN_TOTP_SECRET=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP
node node_modules/next/dist/bin/next start -p 3080 > /tmp/e2e10-server.log 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -sf http://localhost:3080/api/health >/dev/null && break; sleep 1; done
python3 tests/e2e/e2e10.py
