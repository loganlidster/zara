#!/bin/bash

# This script fixes the daily-update-job by recreating it with proper env vars

echo "Deleting existing daily-update-job..."
gcloud run jobs delete daily-update-job --region=us-central1 --quiet

echo "Creating daily-update-job with proper configuration..."
gcloud run jobs create daily-update-job \
  --image=gcr.io/tradiac-testing/daily-update-job:latest \
  --region=us-central1 \
  --max-retries=0 \
  --task-timeout=600 \
  --memory=2Gi \
  --cpu=1

echo "Setting environment variables..."
gcloud run jobs update daily-update-job \
  --region=us-central1 \
  --update-env-vars DB_HOST=34.41.97.179 \
  --update-env-vars DB_PORT=5432 \
  --update-env-vars DB_NAME=tradiac_testing \
  --update-env-vars DB_USER=postgres \
  --update-env-vars DB_PASSWORD=Fu3lth3j3t! \
  --update-env-vars POLYGON_API_KEY=K_hSDwyuUSqRmD57vOlUmYqZGdcZsoG0

echo "Done! Now run:"
echo "gcloud run jobs execute daily-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-25 --wait"