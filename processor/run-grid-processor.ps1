# PowerShell script to run the grid processor
# Usage: .\run-grid-processor.ps1 2025-09-24 2025-09-25

param(
    [Parameter(Mandatory=$true)]
    [string]$StartDate,
    
    [Parameter(Mandatory=$true)]
    [string]$EndDate
)

Write-Host "🚀 Starting Grid Processor" -ForegroundColor Green
Write-Host "Date Range: $StartDate to $EndDate" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Run the parallel processor
Write-Host "⚡ Running parallel processor..." -ForegroundColor Green
Write-Host "This will process 10 combinations at a time" -ForegroundColor Cyan
Write-Host "Progress is saved automatically - you can stop and resume anytime" -ForegroundColor Cyan
Write-Host ""

node grid-processor-parallel.js $StartDate $EndDate

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Processing complete!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Processing failed with exit code $LASTEXITCODE" -ForegroundColor Red
}