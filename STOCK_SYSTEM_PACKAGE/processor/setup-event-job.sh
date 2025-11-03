#!/bin/bash

# Setup Event Update Job on Cloud Run
# This script builds and deploys the event update job to Google Cloud Run

PROJECT_ID="tradiac-testing"
REGION="us-central1"
JOB_NAME="event-update-job"

echo "========================================"
echo "Event Update Job Deployment"
echo "========================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Job Name: $JOB_NAME"
echo ""

# Set project
echo "Setting project..."
gcloud config set project $PROJECT_ID

# Build the Docker image
echo ""
echo "Building Docker image..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$JOB_NAME"
docker build -f Dockerfile.event-update -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo "Docker build failed!"
    exit 1
fi

# Push to Google Container Registry
echo ""
echo "Pushing image to GCR..."
docker push $IMAGE_NAME

if [ $? -ne 0 ]; then
    echo "Docker push failed!"
    exit 1
fi

# Deploy to Cloud Run Jobs
echo ""
echo "Deploying to Cloud Run Jobs..."
gcloud run jobs create $JOB_NAME \
    --image=$IMAGE_NAME \
    --region=$REGION \
    --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!" \
    --max-retries=0 \
    --task-timeout=3600 \
    --memory=4Gi \
    --cpu=2 \
    --execute-now=false

if [ $? -ne 0 ]; then
    echo ""
    echo "Job might already exist. Updating instead..."
    gcloud run jobs update $JOB_NAME \
        --image=$IMAGE_NAME \
        --region=$REGION \
        --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!" \
        --max-retries=0 \
        --task-timeout=3600 \
        --memory=4Gi \
        --cpu=2 \
        --region=$REGION
fi

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "To run manually:"
echo "  gcloud run jobs execute $JOB_NAME --region=$REGION"
echo ""
echo "To run for specific date:"
echo "  gcloud run jobs execute $JOB_NAME --region=$REGION --update-env-vars=TARGET_DATE=2025-10-24"
echo ""
echo "To view logs:"
echo "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=$JOB_NAME' --limit=50 --format=json"
echo ""

# Ask about Cloud Scheduler
read -p "Would you like to set up Cloud Scheduler to run this daily at 2 AM EST? (Y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Setting up Cloud Scheduler..."
    
    SCHEDULER_NAME="event-update-daily"
    
    # Create or update scheduler job
    gcloud scheduler jobs create http $SCHEDULER_NAME \
        --location=$REGION \
        --schedule="0 7 * * *" \
        --time-zone="America/New_York" \
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/$JOB_NAME:run" \
        --http-method=POST \
        --oauth-service-account-email="$PROJECT_ID@appspot.gserviceaccount.com" \
        --description="Run event update job daily at 2 AM EST"
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "Scheduler might already exist. Updating instead..."
        gcloud scheduler jobs update http $SCHEDULER_NAME \
            --location=$REGION \
            --schedule="0 7 * * *" \
            --time-zone="America/New_York" \
            --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/$JOB_NAME:run" \
            --http-method=POST \
            --oauth-service-account-email="$PROJECT_ID@appspot.gserviceaccount.com"
    fi
    
    echo ""
    echo "Cloud Scheduler configured!"
    echo "Job will run daily at 2 AM EST (7 AM UTC)"
fi

echo ""
echo "Setup complete!"