# Fast deployment script for Cloudflare Pages (Wrangler) + GitHub
param(
    [string]$msg = "responsive design updates for mobile and all screens",
    [string]$apiToken = ""
)

$projectRoot = $PSScriptRoot
$ErrorActionPreference = "Continue"

Write-Host "==> 1. Preparing dist folder..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "$projectRoot\dist" -Force | Out-Null
Copy-Item "$projectRoot\index.html" "$projectRoot\dist\" -Force
Copy-Item "$projectRoot\assets" "$projectRoot\dist\" -Recurse -Force
if (Test-Path "$projectRoot\CNAME") {
    Copy-Item "$projectRoot\CNAME" "$projectRoot\dist\" -Force
}

Write-Host "==> 2. Deploying directly to Cloudflare Pages via Wrangler..." -ForegroundColor Cyan
$env:CLOUDFLARE_ACCOUNT_ID = "6c8cc1f1a3f0af27b949d785c31c8c6c"
if ($apiToken -ne "") {
    $env:CLOUDFLARE_API_TOKEN = $apiToken
} elseif (-not $env:CLOUDFLARE_API_TOKEN) {
    $env:CLOUDFLARE_API_TOKEN = "cfoat_4cv1kQfsREbL3nFVOVMxw215VdTUo3TdxoyUuhoF908.xbZVaaAaqJAB3SlejaW4m5ndnClbOMv6TGdEYNktjJ8"
}

npx --yes wrangler pages deploy "$projectRoot\dist" --project-name=dr-norhan --branch=main --commit-dirty=true

Write-Host "==> 3. Syncing with GitHub..." -ForegroundColor Cyan
if (Test-Path "D:\dr-norhan") {
    Copy-Item "$projectRoot\index.html" "D:\dr-norhan\index.html" -Force
    if (Test-Path "$projectRoot\CNAME") {
        Copy-Item "$projectRoot\CNAME" "D:\dr-norhan\CNAME" -Force
    }
    git -C "D:\dr-norhan" add index.html CNAME
    git -C "D:\dr-norhan" -c user.name="MAMDOUH" -c user.email="hassanmamdouh461@gmail.com" commit -m "$msg" 2>$null
    git -C "D:\dr-norhan" push origin main
}

git -C "$projectRoot" add index.html CNAME deploy.ps1
git -C "$projectRoot" -c user.name="MAMDOUH" -c user.email="hassanmamdouh461@gmail.com" commit -m "$msg" 2>$null
git -C "$projectRoot" push origin main

Write-Host "==> Done! Live on: https://d1.engaz.tech (and https://dr-norhan.pages.dev)" -ForegroundColor Green
