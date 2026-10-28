#!/usr/bin/env bash
# Usage (from frontend/): DATABASE_URL=mysql://root@127.0.0.1:3306/sportiq_e2e9 bash tests/e2e/run-e2e9.sh   (database must be empty/fresh)
set -euo pipefail
HASH=$(node scripts/hash-password.mjs test-password-12345)
export SEED_DEMO_DATA=true ADMIN_PASSWORD_HASH="$HASH" SPORTIQ_E2E=1 ADMIN_TOTP_SECRET=KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU SESSION_SECRET=testsecret1234567890-abcdefghijklmnop \
  SITE_URL=http://localhost:3079 PAYHERE_MERCHANT_ID=1200001 PAYHERE_MERCHANT_SECRET=testsecret PAYHERE_MODE=sandbox \
  PAYHERE_APP_ID=app PAYHERE_APP_SECRET=appsecret PAYHERE_API_BASE=http://127.0.0.1:4010 HOUSEKEEPING_SECONDS=5 \
  BANK_NAME=TestBank BANK_ACCOUNT_NAME=SPORTIQ BANK_ACCOUNT_NUMBER=123456
node node_modules/next/dist/bin/next start -p 3079 > /tmp/e2e9-server.log 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -sf http://localhost:3079/api/health >/dev/null && break; sleep 1; done
python3 tests/e2e/e2e9.py
