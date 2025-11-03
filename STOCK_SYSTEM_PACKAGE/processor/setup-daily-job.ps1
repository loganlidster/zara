# Setup script for Daily Update Job (PowerShell version)
# Usage: $env:POLYGON_API_KEY="your_key"; .\setup-daily-job.ps1

$PROJECT_ID = "tradiac-testing"
$REGION = "us-central1"
$JOB_NAME = "daily-update-job"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$JOB_NAME"

Write-Host "🚀 Setting up Daily Update Job for RAAS Tracking System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if POLYGON_API_KEY is set
if (-not $env:POLYGON_API_KEY) {
    Write-Host "❌ Error: POLYGON_API_KEY environment variable is required" -ForegroundColor Red
    Write-Host "Usage: `$env:POLYGON_API_KEY='your_key'; .\setup-daily-job.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Polygon API Key found" -ForegroundColor Green
Write-Host ""

# Step 1: Build the Docker image
Write-Host "📦 Step 1: Building Docker image..." -ForegroundColor Yellow
gcloud builds submit `
  --tag $IMAGE_NAME `
  --project $PROJECT_ID `
  --dockerfile Dockerfile.daily-update `
  .

Write-Host "✓ Docker image built successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Create or update the Cloud Run Job
Write-Host "🔧 Step 2: Creating Cloud Run Job..." -ForegroundColor Yellow

$envVars = "DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!,POLYGON_API_KEY=$env:POLYGON_API_KEY"

# Try to create, if it exists, update instead
gcloud run jobs create $JOB_NAME `
  --image $IMAGE_NAME `
  --region $REGION `
  --project $PROJECT_ID `
  --set-env-vars=$envVars `
  --max-retries 3 `
  --task-timeout 30m `
  --memory 2Gi `
  --cpu 2 `
  2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Job already exists, updating..." -ForegroundColor Yellow
    gcloud run jobs update $JOB_NAME `
      --image $IMAGE_NAME `
      --region $REGION `
      --project $PROJECT_ID `
      --set-env-vars=$envVars `
      --max-retries 3 `
      --task-timeout 30m `
      --memory 2Gi `
      --cpu 2
}

Write-Host "✓ Cloud Run Job created/updated" -ForegroundColor Green
Write-Host ""

# Step 3: Test the job
Write-Host "🧪 Step 3: Testing the job..." -ForegroundColor Yellow
$response = Read-Host "Would you like to run a test execution? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    gcloud run jobs execute $JOB_NAME `
      --region $REGION `
      --project $PROJECT_ID `
      --wait
    Write-Host "✓ Test execution completed" -ForegroundColor Green
} else {
    Write-Host "⊘ Skipping test execution" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Set up Cloud Scheduler
Write-Host "⏰ Step 4: Setting up Cloud Scheduler..." -ForegroundColor Yellow
Write-Host "This will create a scheduler job to run daily at 1 AM EST (6 AM UTC)" -ForegroundColor Cyan
$response = Read-Host "Continue? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    # Get the service account email
    $SERVICE_ACCOUNT = gcloud iam service-accounts list `
      --project $PROJECT_ID `
      --filter="email:*compute@developer.gserviceaccount.com" `
      --format="value(email)" `
      --limit=1
    
    $uri = "https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/${JOB_NAME}:run"
    
    # Try to create, if exists, update
    gcloud scheduler jobs create http daily-update-trigger `
      --location $REGION `
      --schedule="0 6 * * *" `
      --time-zone="America/New_York" `
      --uri=$uri `
      --http-method POST `
      --oauth-service-account-email $SERVICE_ACCOUNT `
      --project $PROJECT_ID `
      2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Scheduler already exists, updating..." -ForegroundColor Yellow
        gcloud scheduler jobs update http daily-update-trigger `
          --location $REGION `
          --schedule="0 6 * * *" `
          --time-zone="America/New_York" `
          --uri=$uri `
          --http-method POST `
          --oauth-service-account-email $SERVICE_ACCOUNT `
          --project $PROJECT_ID
    }
    
    Write-Host "✓ Cloud Scheduler job created/updated" -ForegroundColor Green
} else {
    Write-Host "⊘ Skipping Cloud Scheduler setup" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "  • Cloud Run Job: $JOB_NAME"
Write-Host "  • Region: $REGION"
Write-Host "  • Schedule: Daily at 1 AM EST (6 AM UTC)"
Write-Host "  • Image: $IMAGE_NAME"
Write-Host ""
Write-Host "🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "  • Job Details: https://console.cloud.google.com/run/jobs/details/$REGION/$JOB_NAME?project=$PROJECT_ID"
Write-Host "  • Scheduler: https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID"
Write-Host "  • Logs: https://console.cloud.google.com/logs/query?project=$PROJECT_ID"
Write-Host ""