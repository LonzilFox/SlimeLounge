@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SlimeLounge v0.4.3 Local Server
where node >nul 2>&1
if errorlevel 1 goto NO_NODE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\01_runtime\01_start_local.ps1"
set "ERR=%ERRORLEVEL%"
echo.
echo Server stopped. Error code: %ERR%
pause
exit /b %ERR%
:NO_NODE
echo [ERROR] Node.js was not found.
pause
exit /b 1
