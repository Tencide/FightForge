#Requires -Version 5.1
<#
  Applies backend/.env.fly to Fly secrets (one key at a time — safe for passwords with special chars).
  Prerequisites:
    - flyctl installed (Windows: https://fly.io/docs/hands-on/install-flyctl/)
    - fly auth login
    - cd backend && copy .env.fly.example .env.fly  then edit .env.fly

  Usage (from repo root):
    pwsh -File backend/scripts/apply-fly-secrets.ps1

  Or from backend/:
    pwsh -File scripts/apply-fly-secrets.ps1
#>

$ErrorActionPreference = 'Stop'

$fly =
  if (Test-Path (Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe')) {
    (Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe')
  } elseif (Get-Command flyctl -ErrorAction SilentlyContinue) {
    'flyctl'
  } else {
    Write-Error 'flyctl not found. Install: https://fly.io/docs/hands-on/install-flyctl/'
  }

$backendDir = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backendDir '.env.fly'
if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile — copy backend/.env.fly.example to backend/.env.fly and edit."
}

Push-Location $backendDir
try {
Write-Host "Using flyctl: $fly"
Write-Host "Working directory (fly.toml): $(Get-Location)"
Write-Host "Reading secrets from: $envFile"
Write-Host ''

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq '' -or $line.StartsWith('#')) { return }
  $eq = $line.IndexOf('=')
  if ($eq -lt 1) { return }
  $key = $line.Substring(0, $eq).Trim()
  $val = $line.Substring($eq + 1).Trim()
  if ($key -eq '') { return }
  Write-Host "Setting $key ..."
  & $fly secrets set "$key=$val"
}

Write-Host ''
Write-Host 'Done. Next: fly deploy'
} finally {
  Pop-Location
}
