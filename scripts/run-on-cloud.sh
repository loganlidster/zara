#!/bin/bash

# Run Event-Based Processor on Google Cloud Run Job
# This runs the processor on Cloud infrastructure with 8 vCPUs

set -e

PROJECT_ID="tradiac-testing"
REGION="us-central1"
JOB_NAME="event-processor"
START_DATE="${1:-2024-01-01}"
END_DATE="${2:-2024-12-31}"
PARALLEL="${3:-8}"

echo "=========================================="
echo "Running Event Processor on Cloud Run Job"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Start Date: $START_DATE"
echo "End Date: $END_DATE"
echo "Parallel Workers: $PARALLEL"
echo "=========================================="
echo ""

# Build and push the image
echo "Building processor image..."
gcloud builds submit \
  --config=cloudbuild-processor.yaml \
  --project=$PROJECT_ID

echo ""
echo "Creating/Updating Cloud Run Job..."

# Create or update the job
gcloud run jobs create $JOB_NAME \
  --image=gcr.io/$PROJECT_ID/event-processor:latest \
  --region=$REGION \
  --project=$PROJECT_ID \
  --cpu=8 \
  --memory=16Gi \
  --max-retries=0 \
  --task-timeout=4h \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_SSL=true" \
  --set-secrets="DB_PASSWORD=db-password:latest" \
  --args="$START_DATE,$END_DATE,$PARALLEL" \
  2>/dev/null || \
gcloud run jobs update $JOB_NAME \
  --image=gcr.io/$PROJECT_ID/event-processor:latest \
  --region=$REGION \
  --project=$PROJECT_ID \
  --cpu=8 \
  --memory=16Gi \
  --max-retries=0 \
  --task-timeout=4h \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_SSL=true" \
  --set-secrets="DB_PASSWORD=db-password:latest" \
  --args="$START_DATE,$END_DATE,$PARALLEL"

echo ""
echo "Executing job..."
gcloud run jobs execute $JOB_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --wait

echo ""
echo "=========================================="
echo "Job Complete!"
echo "=========================================="
echo ""
echo "View logs:"
echo "gcloud logging read &quot;resource.type=cloud_run_job AND resource.labels.job_name=$JOB_NAME&quot; --limit=100 --project=$PROJECT_ID"