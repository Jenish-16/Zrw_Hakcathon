@echo off
title AssetFlow
cd /d "%~dp0"

echo ============================================================
echo   AssetFlow - Enterprise Asset ^& Resource Management
echo ============================================================
echo.

REM --- Check Node.js is installed ---------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Please install Node.js 18+ from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

REM --- Install dependencies on first run --------------------------------
if not exist "node_modules" (
  echo Installing dependencies ^(first run, this may take a minute^)...
  call npm install
  echo.
)

REM --- Open the app in the browser once it is ready ---------------------
echo The app will open in your browser in a few seconds...
start "" cmd /c "timeout /t 12 >nul & start http://localhost:5173"

echo.
echo Starting the server + client. Keep this window open.
echo Close this window (or press Ctrl+C) to stop the app.
echo ------------------------------------------------------------
echo.

REM --- Run server (port 4000) + client (port 5173) together -------------
call npm run dev

pause
