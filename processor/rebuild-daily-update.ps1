# Rebuild and Deploy daily-update-job
# This script rebuilds the Docker image with the bug fix and deploys it

Write-Host "🔧 Rebuilding daily-update-job with bug fix..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull latest code
Write-Host "📥 Step 1: Pulling latest code from GitHub..." -ForegroundColor Yellow
git pull origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to pull latest code" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Code updated" -ForegroundColor Green
Write-Host ""

# Step 2: Build Docker image
Write-Host "🐳 Step 2: Building Docker image..." -ForegroundColor Yellow
docker build --no-cache -t gcr.io/tradiac-testing/daily-update-job:latest -f Dockerfile.daily-update .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build Docker image" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image built successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Push to GCR
Write-Host "☁️ Step 3: Pushing image to Google Container Registry..." -ForegroundColor Yellow
docker push gcr.io/tradiac-testing/daily-update-job:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push image" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Image pushed successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Update Cloud Run job
Write-Host "🚀 Step 4: Updating Cloud Run job..." -ForegroundColor Yellow
gcloud run jobs update daily-update-job --image gcr.io/tradiac-testing/daily-update-job:latest --region us-central1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to update Cloud Run job" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Cloud Run job updated" -ForegroundColor Green
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Rebuild Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test with Oct 25: gcloud run jobs execute daily-update-job --region us-central1 --args=`"TARGET_DATE=2024-10-25`""
Write-Host "2. Process Oct 27: gcloud run jobs execute daily-update-job --region us-central1 --args=`"TARGET_DATE=2024-10-27`""
Write-Host "3. Process Oct 28: gcloud run jobs execute daily-update-job --region us-central1 --args=`"TARGET_DATE=2024-10-28`""
Write-Host "4. Run event-update-job for Oct 27, 28"
Write-Host ""