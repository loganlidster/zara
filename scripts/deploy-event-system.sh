#!/bin/bash

# Deploy Event-Based Trade Logging System
# This script deploys the new event-based system to Cloud SQL and Cloud Run

set -e

echo "=========================================="
echo "Event-Based System Deployment"
echo "=========================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Configuration
PROJECT_ID="tradiac-testing"
REGION="us-central1"
INSTANCE_NAME="tradiac-db"

echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Instance: $INSTANCE_NAME"
echo ""

# Step 1: Deploy database schema
echo "Step 1: Deploying database schema..."
echo "----------------------------------------"

if [ -f "database/create_event_tables.sql" ]; then
    echo "Executing create_event_tables.sql..."
    gcloud sql connect $INSTANCE_NAME --project=$PROJECT_ID --database=tradiac < database/create_event_tables.sql
    echo "✓ Database schema deployed"
else
    echo "Error: database/create_event_tables.sql not found"
    exit 1
fi

echo ""

# Step 2: Commit and push code changes
echo "Step 2: Committing code changes..."
echo "----------------------------------------"

git add .
git commit -m "Deploy event-based trade logging system" || echo "No changes to commit"
git push origin main

echo "✓ Code pushed to repository"
echo ""

# Step 3: Wait for Cloud Build
echo "Step 3: Waiting for Cloud Build deployment..."
echo "----------------------------------------"
echo "Cloud Build will automatically deploy the API to Cloud Run"
echo "Monitor progress at: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""
echo "Waiting 60 seconds for build to start..."
sleep 60

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Verify API deployment in Cloud Run console"
echo "2. Test event endpoints: curl https://your-api-url/api/events/metadata"
echo "3. Run event-based processor to backfill data"
echo "4. Update frontend to use new endpoints"
echo ""