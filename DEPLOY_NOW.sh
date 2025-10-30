#!/bin/bash
# ONE COMMAND TO DEPLOY EVERYTHING
# Run this in Cloud Shell: bash <(curl -s https://raw.githubusercontent.com/loganlidster/zara/main/DEPLOY_NOW.sh)

set -e

echo "🚀 Deploying Fixed Daily Update Job"
echo "===================================="
echo ""

# Clone/pull latest code
if [ -d "zara" ]; then
  cd zara
  git pull origin main
else
  git clone https://github.com/loganlidster/zara.git
  cd zara
fi

cd processor

# Build and push image
echo "📦 Building Docker image..."
gcloud builds submit \
  --tag gcr.io/tradiac-testing/daily-update-job:latest \
  --timeout=10m \
  -f Dockerfile.daily-update \
  .

# Update Cloud Run job
echo "🔄 Updating Cloud Run job..."
gcloud run jobs update daily-update-job \
  --image gcr.io/tradiac-testing/daily-update-job:latest \
  --region us-central1

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Now testing with Oct 27, 2025..."
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --args="TARGET_DATE=2025-10-27" \
  --wait

echo ""
echo "Processing Oct 28, 2025..."
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --args="TARGET_DATE=2025-10-28" \
  --wait

echo ""
echo "Processing Oct 29, 2025..."
gcloud run jobs execute daily-update-job \
  --region us-central1 \
  --args="TARGET_DATE=2025-10-29" \
  --wait

echo ""
echo "🎉 All dates processed!"
echo ""
echo "Next: Run event-update-job for these dates"