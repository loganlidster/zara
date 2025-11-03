#!/bin/bash
# Rebuild and Deploy daily-update-job
# This script rebuilds the Docker image with the bug fix and deploys it

echo "🔧 Rebuilding daily-update-job with bug fix..."
echo ""

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Failed to pull latest code"
    exit 1
fi

echo "✅ Code updated"
echo ""

# Step 2: Build Docker image
echo "🐳 Step 2: Building Docker image..."
docker build --no-cache -t gcr.io/tradiac-testing/daily-update-job:latest -f Dockerfile.daily-update .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image"
    exit 1
fi

echo "✅ Image built successfully"
echo ""

# Step 3: Push to GCR
echo "☁️ Step 3: Pushing image to Google Container Registry..."
docker push gcr.io/tradiac-testing/daily-update-job:latest

if [ $? -ne 0 ]; then
    echo "❌ Failed to push image"
    exit 1
fi

echo "✅ Image pushed successfully"
echo ""

# Step 4: Update Cloud Run job
echo "🚀 Step 4: Updating Cloud Run job..."
gcloud run jobs update daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job:latest \
  --region us-central1

if [ $? -ne 0 ]; then
    echo "❌ Failed to update Cloud Run job"
    exit 1
fi

echo "✅ Cloud Run job updated"
echo ""

echo "================================"
echo "✅ Rebuild Complete!"
echo ""
echo "Next steps:"
echo "1. Test with Oct 25: gcloud run jobs execute daily-update-job --region us-central1 --args=&quot;TARGET_DATE=2024-10-25&quot;"
echo "2. Process Oct 27: gcloud run jobs execute daily-update-job --region us-central1 --args=&quot;TARGET_DATE=2024-10-27&quot;"
echo "3. Process Oct 28: gcloud run jobs execute daily-update-job --region us-central1 --args=&quot;TARGET_DATE=2024-10-28&quot;"
echo "4. Run event-update-job for Oct 27, 28"
echo ""