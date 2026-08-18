@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SlimeLounge v0.0.4 Local Server
where node >nul 2>&1
if errorlevel 1 goto NO_NODE
node local_server.js
set "ERR=%ERRORLEVEL%"
echo.
echo Server stopped. Error code: %ERR%
pause
exit /b %ERR%
:NO_NODE
echo [ERROR] Node.js was not found.
pause
exit /b 1
