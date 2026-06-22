@echo off
setlocal
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
call npm install --no-audit --no-fund
call npm run dev
pause
