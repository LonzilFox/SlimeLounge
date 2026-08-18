$ErrorActionPreference = "SilentlyContinue"
$env:NODE_USE_ENV_PROXY = "1"

# Resolve project root from tools/01_runtime before loading local overrides.
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $projectRoot

# Proxy variables must exist before Node starts. Load optional overrides from .dev.vars here.
$devVars = Join-Path $projectRoot '.dev.vars'
if (Test-Path $devVars) {
  foreach ($line in Get-Content $devVars) {
    if ($line -match '^\s*(HTTP_PROXY|HTTPS_PROXY|NO_PROXY)\s*=\s*(.+?)\s*$') {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
  }
}

function Normalize-Proxy([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  if ($value -match '^https?://') { return $value }
  return "http://$value"
}

if (-not $env:HTTP_PROXY -and -not $env:HTTPS_PROXY) {
  $reg = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
  if ($reg.ProxyEnable -eq 1 -and $reg.ProxyServer) {
    $raw = [string]$reg.ProxyServer
    $http = ""
    $https = ""
    if ($raw.Contains('=')) {
      foreach ($part in $raw.Split(';')) {
        $kv = $part.Split('=', 2)
        if ($kv.Count -ne 2) { continue }
        if ($kv[0].ToLower() -eq 'http') { $http = $kv[1] }
        if ($kv[0].ToLower() -eq 'https') { $https = $kv[1] }
      }
    } else {
      $http = $raw
      $https = $raw
    }
    if (-not $https) { $https = $http }
    if (-not $http) { $http = $https }
    $env:HTTP_PROXY = Normalize-Proxy $http
    $env:HTTPS_PROXY = Normalize-Proxy $https
  }
  if ($reg.AutoConfigURL) {
    $env:SLIMELOUNGE_PROXY_PAC = [string]$reg.AutoConfigURL
  }
}

$existingNoProxy = [string]$env:NO_PROXY
$localNoProxy = 'localhost,127.0.0.1,::1'
if ($existingNoProxy) { $env:NO_PROXY = "$existingNoProxy,$localNoProxy" } else { $env:NO_PROXY = $localNoProxy }

Write-Host "[SlimeLounge] Local server port: 8090"
if ($env:HTTPS_PROXY) {
  try {
    $uri = [Uri]$env:HTTPS_PROXY
    Write-Host "[Proxy] Explicit proxy detected: $($uri.Host):$($uri.Port)"
  } catch { Write-Host "[Proxy] Explicit proxy configured." }
} elseif ($env:SLIMELOUNGE_PROXY_PAC) {
  Write-Host "[Proxy] PAC detected, but Node.js cannot resolve PAC automatically."
  Write-Host "[Proxy] If music search fails, set HTTPS_PROXY in .dev.vars."
} else {
  Write-Host "[Proxy] No explicit Windows proxy detected; outbound fetch will be direct."
}

& node local_server.js
exit $LASTEXITCODE
