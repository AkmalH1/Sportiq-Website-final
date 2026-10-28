@echo off
setlocal
title SPORTIQ - database setup
echo.
echo  Creating the SPORTIQ database in XAMPP / MySQL...
echo.
set "MYSQL="
if exist "C:\xampp\mysql\bin\mysql.exe" set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
if not defined MYSQL for /d %%D in ("C:\Program Files\MySQL\MySQL Server *") do if exist "%%D\bin\mysql.exe" set "MYSQL=%%D\bin\mysql.exe"
if not defined MYSQL for /d %%D in ("C:\Program Files\MariaDB *") do if exist "%%D\bin\mysql.exe" set "MYSQL=%%D\bin\mysql.exe"
if not defined MYSQL (
  echo  Could not find MySQL on this computer.
  echo  Install XAMPP from https://www.apachefriends.org , open the XAMPP Control Panel,
  echo  click START next to MySQL, then double-click this file again.
  start "" "https://www.apachefriends.org/download.html"
  pause
  exit /b 1
)
echo  Using: %MYSQL%
"%MYSQL%" -uroot -e "CREATE DATABASE IF NOT EXISTS sportiq CHARACTER SET utf8mb4; CREATE USER IF NOT EXISTS 'sportiq'@'localhost' IDENTIFIED BY 'sportiq'; CREATE USER IF NOT EXISTS 'sportiq'@'127.0.0.1' IDENTIFIED BY 'sportiq'; GRANT ALL ON sportiq.* TO 'sportiq'@'localhost'; GRANT ALL ON sportiq.* TO 'sportiq'@'127.0.0.1'; FLUSH PRIVILEGES;"
if errorlevel 1 (
  echo.
  echo  Could not connect. Open the XAMPP Control Panel, click START next to MySQL so it turns green,
  echo  then double-click this file again. If you set a MySQL root password, create the database by hand
  echo  as described in READ-ME-FIRST.txt.
  pause
  exit /b 1
)
echo.
echo  Done. Now double-click START-SPORTIQ.bat
pause
