@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SlimeLounge v0.0.4 Setup
echo ========================================
echo   SlimeLounge v0.0.4 - Setup Check
echo ========================================
echo.
where node >nul 2>&1
if errorlevel 1 goto NO_NODE
node --version
node --check local_server.js
if errorlevel 1 goto FAILED
node --check public\app.js
if errorlevel 1 goto FAILED
node --check shared\games.js
if errorlevel 1 goto FAILED
node tools\validate_project.js
if errorlevel 1 goto FAILED
node tools\test_games_v003.mjs
if errorlevel 1 goto FAILED
echo.
echo [OK] Local mode needs no npm install.
echo [OK] Double-click run_local.bat to start.
goto HOLD
:NO_NODE
echo [ERROR] Node.js was not found.
goto HOLD
:FAILED
echo [ERROR] JavaScript syntax check failed.
:HOLD
echo.
pause
