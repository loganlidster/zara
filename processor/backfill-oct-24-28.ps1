# Backfill script for October 24-28, 2025 (PowerShell version)
# Usage: $env:POLYGON_API_KEY="your_key"; .\backfill-oct-24-28.ps1

if (-not $env:POLYGON_API_KEY) {
    Write-Host "❌ Error: POLYGON_API_KEY environment variable is required" -ForegroundColor Red
    Write-Host "Usage: `$env:POLYGON_API_KEY='your_key'; .\backfill-oct-24-28.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Backfilling data for October 24-28, 2025" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$dates = @("2025-10-24", "2025-10-25", "2025-10-28")

foreach ($date in $dates) {
    Write-Host "📅 Processing $date..." -ForegroundColor Yellow
    $env:TARGET_DATE = $date
    node daily-update-job.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $date completed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ $date failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Start-Sleep -Seconds 2
}

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "✅ Backfill Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Dates processed:" -ForegroundColor Cyan
Write-Host "  • October 24, 2025 (Thursday)"
Write-Host "  • October 25, 2025 (Friday)"
Write-Host "  • October 28, 2025 (Monday)"
Write-Host ""
Write-Host "Note: Oct 26-27 (weekend) skipped - no trading data" -ForegroundColor Yellow
Write-Host ""