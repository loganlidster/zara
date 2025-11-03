# Backfill Event Data for Oct 24-28, 2025
# This script runs the event-update-job for each missing date

param(
    [string]$ProjectId = "tradiac-testing",
    [string]$Region = "us-central1",
    [string]$JobName = "event-update-job"
)

$dates = @(
    "2025-10-24",
    "2025-10-25",
    "2025-10-28"  # Skip weekend (26-27)
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Event Data Backfill - Oct 24-28, 2025" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Dates to process: $($dates.Count)" -ForegroundColor Yellow
Write-Host ""

foreach ($date in $dates) {
    Write-Host "Processing $date..." -ForegroundColor Green
    
    # Execute the job with TARGET_DATE
    gcloud run jobs execute $JobName `
        --region=$Region `
        --update-env-vars="TARGET_DATE=$date" `
        --wait
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $date completed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ $date failed!" -ForegroundColor Red
        Write-Host "Check logs with:" -ForegroundColor Yellow
        Write-Host "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=$JobName' --limit=50" -ForegroundColor White
        
        $continue = Read-Host "Continue with next date? (Y/N)"
        if ($continue -ne "Y" -and $continue -ne "y") {
            Write-Host "Backfill stopped." -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backfill Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All dates processed. Your trade_events tables should now be up to date through Oct 28, 2025." -ForegroundColor Green