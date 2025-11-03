# Fix daily-update-job by adding environment variables

Write-Host "🔧 Updating daily-update-job with environment variables..." -ForegroundColor Cyan

gcloud run jobs update daily-update-job `
  --region us-central1 `
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!,POLYGON_API_KEY=K_hSDwyuUSqRmD57vOlUmYqZGdcZsoG0"

Write-Host ""
Write-Host "✅ Environment variables added!" -ForegroundColor Green
Write-Host ""
Write-Host "Now test it:" -ForegroundColor Yellow
Write-Host 'gcloud run jobs execute daily-update-job --region us-central1 --args="TARGET_DATE=2025-10-30"'