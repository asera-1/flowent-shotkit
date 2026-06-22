@echo off
REM ============================================================
REM  Flowent Shotkit - one-click playground launcher (Windows)
REM  Double-click this file to install everything and open the
REM  studio in your browser. No terminal knowledge needed.
REM ============================================================
setlocal
REM Node is sometimes not on PATH in a fresh shell - add the default location.
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo.
echo [1/2] Installing dependencies (first run only, may take a minute)...
call npm install --no-audit --no-fund || goto :err
echo.
echo [2/2] Starting the playground at http://localhost:5173
echo       (your browser opens automatically; press Ctrl+C here to stop)
echo.
call npm run dev
goto :eof
:err
echo.
echo  ^! Could not run npm. Install Node.js LTS from https://nodejs.org and retry.
pause
