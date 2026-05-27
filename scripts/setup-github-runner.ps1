# Install and register a GitHub Actions self-hosted runner for FightForge (Windows).
#
# Prerequisites:
#   - Repo admin access on GitHub
#   - Node.js 20+ and Docker Desktop (for CI docker job) on this machine
#
# Usage (from repo root):
#   .\scripts\setup-github-runner.ps1
#   .\scripts\setup-github-runner.ps1 -RegistrationToken "AAAA..." -Repo "Tencide/FightForge"
#
# Get a registration token (expires in ~1 hour):
#   GitHub → Repo → Settings → Actions → Runners → New self-hosted runner → Windows

[CmdletBinding()]
param(
    [string]$Repo = "Tencide/FightForge",
    [string]$RunnerName = $env:COMPUTERNAME,
    [string]$InstallRoot = "$env:LOCALAPPDATA\fightforge-actions-runner",
    [string]$RegistrationToken,
    [switch]$InstallService,
    [switch]$SkipConfigure
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

$RunnerLabels = "self-hosted,Windows,X64,fightforge"

Write-Step "Resolving latest actions-runner release"
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/actions/runner/releases/latest" -Headers @{ "User-Agent" = "fightforge-setup" }
$RunnerVersion = $release.tag_name.TrimStart("v")
$asset = $release.assets | Where-Object { $_.name -eq "actions-runner-win-x64-$RunnerVersion.zip" } | Select-Object -First 1
if (-not $asset) {
    $asset = $release.assets | Where-Object { $_.name -like "actions-runner-win-x64-*.zip" } | Select-Object -First 1
}
if (-not $asset) {
    throw "No Windows x64 runner asset found in release $($release.tag_name)"
}
$ZipName = $asset.name
$DownloadUrl = $asset.browser_download_url
Write-Host "Using runner $RunnerVersion ($ZipName)"

Write-Step "FightForge GitHub Actions runner setup"
Write-Host "Repo: $Repo"
Write-Host "Install: $InstallRoot"
Write-Host "Labels: $RunnerLabels"

if (-not $RegistrationToken) {
    Write-Host @"

Registration token required.

1. Open: https://github.com/$Repo/settings/actions/runners/new
2. Choose Windows x64 and copy the token from the configure command
3. Re-run:
   .\scripts\setup-github-runner.ps1 -RegistrationToken "YOUR_TOKEN"

"@ -ForegroundColor Yellow
    exit 1
}

Write-Step "Creating install directory"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Set-Location $InstallRoot

if (-not (Test-Path ".\config.cmd")) {
    Write-Step "Downloading actions-runner v$RunnerVersion"
    $zipPath = Join-Path $env:TEMP $ZipName
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Step "Extracting"
    Expand-Archive -Path $zipPath -DestinationPath $InstallRoot -Force
    Remove-Item $zipPath -Force
}

Write-Step "Configuring runner (unattended)"
& .\config.cmd --unattended `
    --url "https://github.com/$Repo" `
    --token $RegistrationToken `
    --name $RunnerName `
    --labels $RunnerLabels `
    --windows `
    --replace

if ($LASTEXITCODE -ne 0) {
    Write-Error "config.cmd failed with exit code $LASTEXITCODE"
}

if ($InstallService) {
    Write-Step "Installing and starting Windows service"
    & .\svc.cmd install
    & .\svc.cmd start
    Write-Host "Runner service installed. Check status in GitHub → Settings → Actions → Runners."
} else {
    Write-Host @"

Runner configured. Start it in this folder:

  cd `"$InstallRoot`"
  .\run.cmd

Or install as a service (runs at boot):

  cd `"$InstallRoot`"
  .\svc.cmd install
  .\svc.cmd start

"@ -ForegroundColor Green
}

Write-Host @"

Next steps on GitHub:
  1. Repo → Settings → Secrets and variables → Actions → Variables
  2. Add variable USE_SELF_HOSTED = true
  3. Re-run CI workflow (push or Actions tab)

To use GitHub-hosted runners again, delete the variable or set it to false.

"@ -ForegroundColor Green
