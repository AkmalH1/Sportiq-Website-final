#!/usr/bin/env bash
# Usage (from frontend/): DATABASE_URL=... bash tests/e2e/run-regression.sh <port> <scripts...>   e.g. 3077 e2e2 e2e3 e2e4  |  3078 e2e5 e2e6 e2e7 e2e8
set -uo pipefail
PORT=$1; shift
export SEED_DEMO_DATA=true ADMIN_PASSWORD_HASH="$(node scripts/hash-password.mjs test-password-12345)" SPORTIQ_E2E=1 ADMIN_TOTP_SECRET=KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU SESSION_SECRET=testsecret1234567890-abcdefghijklmnop \
  SITE_URL=http://localhost:$PORT BANK_NAME=TestBank BANK_ACCOUNT_NAME=SPORTIQ BANK_ACCOUNT_NUMBER=123456
[ "$PORT" = 3078 ] && export PAYHERE_MERCHANT_ID=1200001 PAYHERE_MERCHANT_SECRET=testsecret PAYHERE_MODE=sandbox
node node_modules/next/dist/bin/next start -p $PORT > /tmp/reg-$PORT.log 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -sf http://localhost:$PORT/api/health >/dev/null && break; sleep 1; done
rc=0
for t in "$@"; do echo "== $t"; python3 tests/e2e/$t.py 2>&1 | tee /tmp/reg-$t.log | grep -E "^(FAIL|FAILED|ALL PASSED)|Error" | head -8 || true; echo "   passes: $(grep -c "^PASS" /tmp/reg-$t.log) fails: $(grep -c "^FAIL" /tmp/reg-$t.log)"; done
