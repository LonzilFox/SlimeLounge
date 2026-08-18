@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "FAIL=0"
for %%F in (package.json wrangler.jsonc local_server.js public\index.html public\app.js public\styles.css src\index.js shared\games.js) do (
  if not exist "%%F" (
    echo [MISSING] %%F
    set "FAIL=1"
  ) else echo [OK] %%F
)
echo.
if "%FAIL%"=="0" echo Repository root is correct.
if not "%FAIL%"=="0" echo Repository root is incomplete.
pause
exit /b %FAIL%
