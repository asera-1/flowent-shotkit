@echo off
cd /d "%~dp0"
echo === flowent-shotkit studio ===
echo Installing dependencies (first run only)...
call npm install
echo Starting dev server and opening your browser...
call npm run dev -- --open
pause
