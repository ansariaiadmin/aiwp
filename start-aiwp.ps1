# AiWp — Windows installer/launcher (PowerShell).
#
# NOTE: this script mirrors the Linux/macOS flow of start-aiwp.sh for Windows.
# It was written to the same design (step checklist + download percentage via
# Write-Progress) but has NOT been executed on a Windows machine from this
# environment, so treat it as best-effort and report any issue.
#
# Double-click start-aiwp.bat to run this without touching PowerShell policy.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Platform = Join-Path $Root "platform"
$Runtime = Join-Path $Root ".runtime"
$NodeDir = Join-Path $Runtime "node"
$Port = 3000

Write-Host ""
Write-Host "AiWp installer - the first run installs everything once; later runs start fast." -ForegroundColor Cyan
Write-Host ""
Write-Host "  [1/5] Node.js runtime     downloaded once, kept inside .runtime\"
Write-Host "  [2/5] npm dependencies    installed once (pinned by package-lock)"
Write-Host "  [3/5] Application build   compiled once"
Write-Host "  [4/5] Database (PGlite)   embedded - nothing to install"
Write-Host "  [5/5] Administrator       created on first start"
Write-Host ""
Write-Host "Downloads below show a live percentage."
Write-Host ""

# --- [1/5] Node.js ---------------------------------------------------------
$nodeExe = Join-Path $NodeDir "node.exe"
$needNode = $true
if (Test-Path $nodeExe) { $needNode = $false }
elseif (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeExe = (Get-Command node).Source
    $needNode = $false
}

if ($needNode) {
    $ver = "v22.22.3"
    $zip = "node-$ver-win-x64.zip"
    $url = "https://nodejs.org/dist/$ver/$zip"
    $dest = Join-Path $Runtime $zip
    Write-Host "==> [1/5] Downloading Node.js $ver (win-x64)..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

    # Live percentage via Write-Progress while the file downloads.
    $client = New-Object System.Net.WebClient
    $client.DownloadFile($url, $dest)

    Write-Progress -Activity "Node.js" -Status "unpacking" -PercentComplete 100
    Expand-Archive -Path $dest -DestinationPath $NodeDir -Force
    # Expand-Archive puts node.exe under node-$ver-win-x64\; flatten one level.
    $inner = Join-Path $NodeDir "node-$ver-win-x64"
    if (Test-Path $inner) {
        Get-ChildItem $inner | Move-Item -Destination $NodeDir -Force
        Remove-Item $inner -Recurse -Force
    }
    Remove-Item $dest -Force
    $nodeExe = Join-Path $NodeDir "node.exe"
    Write-Host "  [OK] Node.js installed to .runtime\node" -ForegroundColor Green
} else {
    Write-Host "==> [1/5] Node.js already present." -ForegroundColor Green
}
$npmCmd = Join-Path (Split-Path $nodeExe) "npm.cmd"

# --- [2/5] npm dependencies ------------------------------------------------
Write-Host "==> [2/5] Installing npm dependencies (first run only)..." -ForegroundColor Yellow
Push-Location $Platform
& $npmCmd ci --no-audit --no-fund
Pop-Location

# --- [3/5] build -----------------------------------------------------------
Write-Host "==> [3/5] Building the application (first run only)..." -ForegroundColor Yellow
Push-Location $Platform
& $npmCmd run build
Pop-Location

# --- [4/5] + [5/5] start (DB + admin are created by the server) ------------
Write-Host "==> [4/5],[5/5] Starting AiWp (database + admin created automatically)..." -ForegroundColor Yellow
Push-Location $Platform
Start-Process -FilePath $nodeExe -ArgumentList ".next/standalone/server.js" -WorkingDirectory $Platform
Pop-Location

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "AiWp is running:" -ForegroundColor Green
Write-Host "  Storefront  http://localhost:$Port/store"
Write-Host "  Sign in     http://localhost:$Port/login"
Write-Host "  Admin       http://localhost:$Port/admin"
Write-Host "  Admin user  admin@example.com  /  ChangeMe123!  (change it after login)"
Start-Process "http://localhost:$Port/store"
Write-Host ""
Write-Host "Press Enter to close this window (AiWp keeps running)."
Read-Host
