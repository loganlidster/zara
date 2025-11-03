# Setup Event Update Job on Cloud Run
# This script builds and deploys the event update job to Google Cloud Run

param(
    [string]$ProjectId = "tradiac-testing",
    [string]$Region = "us-central1",
    [string]$JobName = "event-update-job"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Event Update Job Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Job Name: $JobName" -ForegroundColor Yellow
Write-Host ""

# Set project
Write-Host "Setting project..." -ForegroundColor Green
gcloud config set project $ProjectId

# Build the Docker image
Write-Host ""
Write-Host "Building Docker image..." -ForegroundColor Green
$ImageName = "gcr.io/$ProjectId/$JobName"
docker build -f Dockerfile.event-update -t $ImageName .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

# Push to Google Container Registry
Write-Host ""
Write-Host "Pushing image to GCR..." -ForegroundColor Green
docker push $ImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker push failed!" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run Jobs
Write-Host ""
Write-Host "Deploying to Cloud Run Jobs..." -ForegroundColor Green
gcloud run jobs create $JobName `
    --image=$ImageName `
    --region=$Region `
    --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!" `
    --max-retries=0 `
    --task-timeout=3600 `
    --memory=4Gi `
    --cpu=2 `
    --execute-now=false

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Job might already exist. Updating instead..." -ForegroundColor Yellow
    gcloud run jobs update $JobName `
        --image=$ImageName `
        --region=$Region `
        --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!" `
        --max-retries=0 `
        --task-timeout=3600 `
        --memory=4Gi `
        --cpu=2 `
        --region=$Region
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run manually:" -ForegroundColor Yellow
Write-Host "  gcloud run jobs execute $JobName --region=$Region" -ForegroundColor White
Write-Host ""
Write-Host "To run for specific date:" -ForegroundColor Yellow
Write-Host "  gcloud run jobs execute $JobName --region=$Region --update-env-vars=TARGET_DATE=2025-10-24" -ForegroundColor White
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=$JobName' --limit=50 --format=json" -ForegroundColor White
Write-Host ""

# Ask about Cloud Scheduler
Write-Host "Would you like to set up Cloud Scheduler to run this daily at 2 AM EST? (Y/N)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Host "Setting up Cloud Scheduler..." -ForegroundColor Green
    
    $SchedulerName = "event-update-daily"
    
    # Create or update scheduler job
    gcloud scheduler jobs create http $SchedulerName `
        --location=$Region `
        --schedule="0 7 * * *" `
        --time-zone="America/New_York" `
        --uri="https://$Region-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$ProjectId/jobs/$JobName`:run" `
        --http-method=POST `
        --oauth-service-account-email="$ProjectId@appspot.gserviceaccount.com" `
        --description="Run event update job daily at 2 AM EST"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Scheduler might already exist. Updating instead..." -ForegroundColor Yellow
        gcloud scheduler jobs update http $SchedulerName `
            --location=$Region `
            --schedule="0 7 * * *" `
            --time-zone="America/New_York" `
            --uri="https://$Region-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$ProjectId/jobs/$JobName`:run" `
            --http-method=POST `
            --oauth-service-account-email="$ProjectId@appspot.gserviceaccount.com"
    }
    
    Write-Host ""
    Write-Host "Cloud Scheduler configured!" -ForegroundColor Green
    Write-Host "Job will run daily at 2 AM EST (7 AM UTC)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green