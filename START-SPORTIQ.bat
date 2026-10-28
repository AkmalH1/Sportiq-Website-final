@echo off
setlocal
title SPORTIQ - starting
cd /d "%~dp0frontend"

echo.
echo  ==============================
echo    SPORTIQ  -  starting up
echo  ==============================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)"
if errorlevel 1 goto oldnode
goto nodeok

:nonode
echo  Node.js is not installed.
echo  A download page will open. Install the "LTS" version, then double-click this file again.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:oldnode
echo  Your Node.js is too old. SPORTIQ needs version 20.9 or newer.
echo  A download page will open. Install the "LTS" version, then double-click this file again.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:nodeok
if not exist ".env.local" (
  echo  Creating settings file...
  (
    echo SITE_URL=http://localhost:3000
    echo ADMIN_PASSWORD=sportiq-admin
    echo SESSION_SECRET=local-test-secret-change-me-before-going-live-1234567890
    echo SHIPPING_FEE_LKR=0
    echo DATABASE_URL=mysql://sportiq:sportiq@127.0.0.1:3306/sportiq
    echo SEED_DEMO_DATA=true
  ) > .env.local
)

:envok
findstr /b /c:"DATABASE_URL=" ".env.local" >nul 2>nul
if errorlevel 1 (
  echo  Adding the missing database setting to .env.local...
  echo DATABASE_URL=mysql://sportiq:sportiq@127.0.0.1:3306/sportiq>> .env.local
  echo SEED_DEMO_DATA=true>> .env.local
)

where docker >nul 2>nul
if errorlevel 1 (
  echo  Docker not found. Using MySQL on this computer instead. First time? Install XAMPP, start MySQL, and run SETUP-DATABASE-XAMPP.bat once.
) else (
  echo  Starting the local MySQL database...
  docker compose -f ..\docker-compose.dev.yml up -d
  if errorlevel 1 echo  Docker could not start the database. Open Docker Desktop, wait until it says running, then try again.
)

if not exist "node_modules\mysql2\package.json" (
  echo  Installing, this takes 1 to 3 minutes the first time. Please wait...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Install failed. Check your internet connection and double-click this file again.
    pause
    exit /b 1
  )
)

call node scripts\wait-db.mjs 90
if errorlevel 1 (
  pause
  exit /b 1
)
call node scripts\ensure-db.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo  Starting the store. Your browser will open in a few seconds.
echo.
echo    Store:   http://localhost:3000
echo    Admin:   http://localhost:3000/admin/login   password: sportiq-admin  (LOCAL TEST ONLY, never for a live site)
echo.
echo  Keep this window open while you use the store. Close it to stop.
echo.
start "" /b cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
