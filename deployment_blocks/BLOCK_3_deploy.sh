#!/bin/bash
# BLOCK 3: Build and Deploy to Cloud Run
# This builds Docker image and deploys as Cloud Run Job

cd ~/zara/cloudshell_crypto

gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator

gcloud run jobs deploy crypto-event-job \
  --image gcr.io/tradiac-testing/crypto-event-generator \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --max-retries 0 \
  --task-timeout 3h \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

echo "✅ Deployment complete!"