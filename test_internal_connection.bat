@echo off
setlocal
set "TARGET=%~1"
if "%TARGET%"=="" set /p "TARGET=Target IP (example 100.101.154.50 or 141.2.187.88): "
if "%TARGET%"=="" exit /b 1
set "PORT=8090"
echo.
echo === SlimeLounge internal connectivity test ===
echo Target: %TARGET%:%PORT%
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Test-NetConnection -ComputerName '%TARGET%' -Port %PORT% -InformationLevel Detailed | Format-List ComputerName,RemoteAddress,RemotePort,NameResolutionResults,MatchingIPsecRules,NetworkIsolationContext,InterfaceAlias,SourceAddress,NetRoute,TcpTestSucceeded"
echo.
echo === Route table match ===
route print %TARGET%
echo.
pause
