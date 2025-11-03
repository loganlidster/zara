#!/bin/bash

# Crypto Event Generation - Cloud Run Deployment Script
# Creates ONE job, then executes it twice (once per method)

PROJECT_ID="tradiac-testing"
REGION="us-central1"

echo "========================================="
echo "Deploying Crypto Event Generation Job"
echo "========================================="

# Build the Docker image
echo "Building Docker image..."
gcloud builds submit --tag gcr.io/${PROJECT_ID}/crypto-event-job

# Create the job (only once)
echo ""
echo "Creating crypto-event-job..."
gcloud run jobs create crypto-event-job \
  --image gcr.io/${PROJECT_ID}/crypto-event-job \
  --region ${REGION} \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t! \
  --memory 8Gi \
  --cpu 4 \
  --max-retries 0 \
  --task-timeout 3h

echo ""
echo "========================================="
echo "Job created! Now run it twice:"
echo "========================================="
echo ""
echo "# Run EQUAL_MEAN:"
echo "gcloud run jobs execute crypto-event-job --region ${REGION} --update-env-vars METHOD=EQUAL_MEAN,BUY_MAX=3.0,SELL_MIN=0.1,SELL_MAX=3.0,START_DATE=2024-05-01,END_DATE=2025-11-02"
echo ""
echo "# Run WINSORIZED:"
echo "gcloud run jobs execute crypto-event-job --region ${REGION} --update-env-vars METHOD=WINSORIZED,BUY_MAX=3.0,SELL_MIN=0.1,SELL_MAX=3.0,START_DATE=2024-05-01,END_DATE=2025-11-02"
echo ""
echo "Monitor at:"
echo "https://console.cloud.google.com/run/jobs?project=${PROJECT_ID}"