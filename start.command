#!/usr/bin/env bash
# Mac / Linux: double-click "start.command" or run: bash start.sh
cd "$(dirname "$0")/frontend" || exit 1
echo; echo " SPORTIQ - starting up"; echo

if ! command -v node >/dev/null 2>&1 || ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)"; then
  echo " Node.js 20.9 or newer is required. Install the LTS version from https://nodejs.org then run this again."
  (command -v open >/dev/null && open "https://nodejs.org/en/download") || (command -v xdg-open >/dev/null && xdg-open "https://nodejs.org/en/download") || true
  read -r -p "Press Enter to close" _; exit 1
fi

if [ ! -f .env.local ]; then
  printf 'SITE_URL=http://localhost:3000\nADMIN_PASSWORD=sportiq-admin\nSESSION_SECRET=local-test-secret-change-me-before-going-live-1234567890\nSHIPPING_FEE_LKR=0\nDATABASE_URL=mysql://sportiq:sportiq@127.0.0.1:3306/sportiq\nSEED_DEMO_DATA=true\n' > .env.local
fi
if command -v docker >/dev/null 2>&1; then
  echo " Starting the local MySQL database (Docker)..."
  docker compose -f ../docker-compose.dev.yml up -d >/dev/null 2>&1 && sleep 15
else
  echo " Docker not found. Make sure MySQL is running with a database 'sportiq' (user sportiq / password sportiq), or edit DATABASE_URL in frontend/.env.local."
fi
if [ ! -f node_modules/mysql2/package.json ]; then
  echo " Installing, this takes 1 to 3 minutes the first time..."
  npm install || { echo " Install failed. Check your internet connection."; read -r -p "Press Enter to close" _; exit 1; }
fi

echo
echo "   Store:  http://localhost:3000"
echo "   Admin:  http://localhost:3000/admin/login   password: sportiq-admin  (LOCAL TEST ONLY, never for a live site)"
echo
(sleep 10; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) || true) &
npm run dev
