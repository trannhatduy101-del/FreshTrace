# Derive paths from script location — works regardless of where the repo is cloned
$ProjectDir  = $PSScriptRoot
$FrontendDir = Join-Path (Split-Path (Split-Path $PSScriptRoot)) "frontend"
$FIXED_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   FreshTrace Dev Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Kill old node on port 8545 ─────────────────────────────────────
Write-Host "[1/3] Killing old Hardhat node..." -ForegroundColor Yellow
$pids = Get-NetTCPConnection -LocalPort 8545 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue |
        Sort-Object -Unique
if ($pids) {
    foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
    Write-Host "     Killed PID(s): $($pids -join ', ')" -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
} else {
    Write-Host "     No existing node on port 8545." -ForegroundColor DarkGray
}

# ── Step 2: Start fresh Hardhat node in a new window ───────────────────────
Write-Host "[2/3] Starting fresh Hardhat node..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectDir'; npx hardhat node"

# Verify frontend directory exists
if (-not (Test-Path $FrontendDir)) {
    Write-Host ""
    Write-Host "ERROR: Frontend not found at: $FrontendDir" -ForegroundColor Red
    Write-Host "Expected structure: repo-root/freshtrace-project/freshtrace/ AND repo-root/frontend/" -ForegroundColor Red
    exit 1
}

# Poll until node responds (max 30 s)
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8545" -Method POST `
             -ContentType "application/json" `
             -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' `
             -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "     Waiting for node... ($i/30)" -ForegroundColor DarkGray
}

if (-not $ready) {
    Write-Host ""
    Write-Host "ERROR: Node did not start in 30s. Check the new terminal window." -ForegroundColor Red
    exit 1
}
Write-Host "     Node ready!" -ForegroundColor Green

# ── Step 3: Deploy + grant roles (nonce=0 => fixed address every time) ──────
Write-Host "[3/3] Deploying contract, granting roles, funding wallet..." -ForegroundColor Yellow
Set-Location $ProjectDir
npx hardhat run scripts/setup.ts --network localhost
npx hardhat run scripts/fund.ts --network localhost

# Verify address matches expected
$envContent = Get-Content "$FrontendDir\.env" -Raw
if ($envContent -match "VITE_CONTRACT_ADDRESS=$([regex]::Escape($FIXED_ADDRESS))") {
    Write-Host "     Address verified: $FIXED_ADDRESS" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "WARNING: Address mismatch! Node may not have been fully fresh." -ForegroundColor Red
    Write-Host "Stop the node window, re-run this script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Contract : $FIXED_ADDRESS" -ForegroundColor White
Write-Host ""
Write-Host "Now do:" -ForegroundColor Cyan
Write-Host "  1. MetaMask -> Settings -> Advanced -> Clear activity tab data" -ForegroundColor White
Write-Host "  2. Open new terminal:"  -ForegroundColor White
Write-Host "       cd '$FrontendDir'" -ForegroundColor DarkGray
Write-Host "       npm run dev" -ForegroundColor DarkGray
Write-Host ""
