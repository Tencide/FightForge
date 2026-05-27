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
# Registration token (expires ~1 hour, single use per attempt):
#   https://github.com/<owner>/<repo>/settings/actions/runners/new
#   Copy ONLY the token from the page — not a Personal Access Token (PAT).

[CmdletBinding()]
param(
    [string]$Repo = "Tencide/FightForge",
    [string]$RunnerName = $env:COMPUTERNAME,
    [string]$InstallRoot = "$env:LOCALAPPDATA\fightforge-actions-runner",
    [string]$RegistrationToken,
    [switch]$InstallService,
    [switch]$CleanInstall
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

# Default runner labels include self-hosted, Windows, X64 — add fightforge for workflows.
$ExtraLabels = "fightforge"

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
$RepoUrl = "https://github.com/$Repo"
Write-Host "Repo: $Repo"
Write-Host "URL:  $RepoUrl"
Write-Host "Install: $InstallRoot"
Write-Host "Extra labels: $ExtraLabels (+ defaults self-hosted, Windows, X64)"

try {
    $null = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo" -Headers @{ "User-Agent" = "fightforge-setup" }
    Write-Host "Repository OK (public or visible to this network)."
} catch {
    Write-Warning "Could not verify repo $Repo via GitHub API. Check owner/name and network."
}

if (-not $RegistrationToken) {
    Write-Host @"

Registration token required.

1. Open: $RepoUrl/settings/actions/runners/new
2. Choose Windows x64
3. Copy the token from the configure command (starts shortly, NOT a PAT)
4. Re-run immediately (tokens expire in ~1 hour):

   .\scripts\setup-github-runner.ps1 -RegistrationToken "YOUR_TOKEN"

If configure failed once, generate a NEW token on that page before retrying.

"@ -ForegroundColor Yellow
    exit 1
}

if ($RegistrationToken.Length -lt 20) {
    Write-Warning "Token looks too short — use the registration token from the runners page, not a PAT."
}

if ($CleanInstall -and (Test-Path $InstallRoot)) {
    Write-Step "Removing existing install ($InstallRoot)"
    Remove-Item -Recurse -Force $InstallRoot
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
$configArgs = @(
    "--unattended",
    "--url", $RepoUrl,
    "--token", $RegistrationToken,
    "--name", $RunnerName,
    "--labels", $ExtraLabels,
    "--replace"
)
if ($InstallService) {
    $configArgs += "--runasservice"
}

& .\config.cmd @configArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host @"

config.cmd failed (exit $LASTEXITCODE).

Common fixes:
  - Generate a NEW registration token (old ones are invalidated after a failed register).
  - Confirm URL matches where you created the token: $RepoUrl
  - Repo → Settings → Actions → General → Allow all actions (if disabled).
  - Retry with a clean install:
      .\scripts\setup-github-runner.ps1 -RegistrationToken "NEW_TOKEN" -CleanInstall

"@ -ForegroundColor Red
    exit $LASTEXITCODE
}

if ($InstallService) {
    Write-Host "Runner registered and installed as a Windows service (--runasservice)."
} else {
    Write-Host @"

Runner registered. Start it:

  cd `"$InstallRoot`"
  .\run.cmd

Or install as a service:

  cd `"$InstallRoot`"
  .\svc.cmd install
  .\svc.cmd start

"@ -ForegroundColor Green
}

Write-Host @"

Next steps on GitHub:
  1. Settings → Actions → Runners — confirm runner is Idle
  2. Settings → Secrets and variables → Actions → Variables → USE_SELF_HOSTED = true
  3. Re-run CI workflow

"@ -ForegroundColor Green
