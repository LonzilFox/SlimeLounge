@echo off
chcp 65001 >nul
setlocal
set /p TARGET=请输入 SlimeLounge 服务器的 iPOP/TAP/VPN IP（例如 141.2.187.88）: 
if "%TARGET%"=="" exit /b 1
echo.
echo ========================================
echo   SlimeLounge iPOP/VPN Connection Test
echo ========================================
echo Target: %TARGET%:8090
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t='%TARGET%'; Write-Host '--- TCP 8090 ---'; Test-NetConnection $t -Port 8090 -InformationLevel Detailed; Write-Host ''; Write-Host '--- Windows selected route ---'; try { Find-NetRoute -RemoteIPAddress $t | Format-List InterfaceAlias,InterfaceIndex,IPAddress,NextHop,RouteMetric } catch { Write-Host $_.Exception.Message }; Write-Host ''; Write-Host '--- TAP / VPN adapters ---'; Get-NetIPConfiguration | Where-Object { $_.InterfaceAlias -match 'tap|vpn|ipop|usg' } | Format-List InterfaceAlias,InterfaceDescription,IPv4Address,IPv4DefaultGateway"
echo.
echo 判定：TcpTestSucceeded=True 才表示这个 VPN 地址可以直接用于 http://%TARGET%:8090
pause
