#!/bin/bash

# Setup script for Daily Update Job
# This script deploys the Cloud Run Job and sets up Cloud Scheduler

set -e

PROJECT_ID="tradiac-testing"
REGION="us-central1"
JOB_NAME="daily-update-job"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${JOB_NAME}"

echo "🚀 Setting up Daily Update Job for RAAS Tracking System"
echo "========================================================"
echo ""

# Check if POLYGON_API_KEY is provided
if [ -z "$POLYGON_API_KEY" ]; then
    echo "❌ Error: POLYGON_API_KEY environment variable is required"
    echo "Usage: POLYGON_API_KEY=your_key ./setup-daily-job.sh"
    exit 1
fi

echo "✓ Polygon API Key found"
echo ""

# Step 1: Build the Docker image
echo "📦 Step 1: Building Docker image..."
gcloud builds submit \
  --tag ${IMAGE_NAME} \
  --project ${PROJECT_ID} \
  --dockerfile Dockerfile.daily-update \
  .

echo "✓ Docker image built successfully"
echo ""

# Step 2: Create or update the Cloud Run Job
echo "🔧 Step 2: Creating Cloud Run Job..."
gcloud run jobs create ${JOB_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!,POLYGON_API_KEY=${POLYGON_API_KEY}" \
  --max-retries 3 \
  --task-timeout 30m \
  --memory 2Gi \
  --cpu 2 \
  2>/dev/null || \
gcloud run jobs update ${JOB_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!,POLYGON_API_KEY=${POLYGON_API_KEY}" \
  --max-retries 3 \
  --task-timeout 30m \
  --memory 2Gi \
  --cpu 2

echo "✓ Cloud Run Job created/updated"
echo ""

# Step 3: Test the job
echo "🧪 Step 3: Testing the job..."
echo "Would you like to run a test execution? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    gcloud run jobs execute ${JOB_NAME} \
      --region ${REGION} \
      --project ${PROJECT_ID} \
      --wait
    echo "✓ Test execution completed"
else
    echo "⊘ Skipping test execution"
fi
echo ""

# Step 4: Set up Cloud Scheduler
echo "⏰ Step 4: Setting up Cloud Scheduler..."
echo "This will create a scheduler job to run daily at 1 AM EST (6 AM UTC)"
echo "Continue? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    # Get the service account email
    SERVICE_ACCOUNT=$(gcloud iam service-accounts list \
      --project ${PROJECT_ID} \
      --filter="email:*compute@developer.gserviceaccount.com" \
      --format="value(email)" \
      --limit=1)
    
    gcloud scheduler jobs create http daily-update-trigger \
      --location ${REGION} \
      --schedule="0 6 * * *" \
      --time-zone="America/New_York" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
      --http-method POST \
      --oauth-service-account-email ${SERVICE_ACCOUNT} \
      --project ${PROJECT_ID} \
      2>/dev/null || \
    gcloud scheduler jobs update http daily-update-trigger \
      --location ${REGION} \
      --schedule="0 6 * * *" \
      --time-zone="America/New_York" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
      --http-method POST \
      --oauth-service-account-email ${SERVICE_ACCOUNT} \
      --project ${PROJECT_ID}
    
    echo "✓ Cloud Scheduler job created/updated"
else
    echo "⊘ Skipping Cloud Scheduler setup"
fi
echo ""

echo "========================================================"
echo "✅ Setup Complete!"
echo ""
echo "📋 Summary:"
echo "  • Cloud Run Job: ${JOB_NAME}"
echo "  • Region: ${REGION}"
echo "  • Schedule: Daily at 1 AM EST (6 AM UTC)"
echo "  • Image: ${IMAGE_NAME}"
echo ""
echo "🔗 Useful Links:"
echo "  • Job Details: https://console.cloud.google.com/run/jobs/details/${REGION}/${JOB_NAME}?project=${PROJECT_ID}"
echo "  • Scheduler: https://console.cloud.google.com/cloudscheduler?project=${PROJECT_ID}"
echo "  • Logs: https://console.cloud.google.com/logs/query?project=${PROJECT_ID}"
echo ""
echo "📝 Next Steps:"
echo "  1. Verify the job ran successfully in Cloud Console"
echo "  2. Check database for new data"
echo "  3. Monitor the scheduler for daily executions"
echo ""