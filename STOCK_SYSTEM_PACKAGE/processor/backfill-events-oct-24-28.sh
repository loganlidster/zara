#!/bin/bash

# Backfill Event Data for Oct 24-28, 2025
# This script runs the event-update-job for each missing date

PROJECT_ID="tradiac-testing"
REGION="us-central1"
JOB_NAME="event-update-job"

dates=(
    "2025-10-24"
    "2025-10-25"
    "2025-10-28"  # Skip weekend (26-27)
)

echo "========================================"
echo "Event Data Backfill - Oct 24-28, 2025"
echo "========================================"
echo "Dates to process: ${#dates[@]}"
echo ""

for date in "${dates[@]}"; do
    echo "Processing $date..."
    
    # Execute the job with TARGET_DATE
    gcloud run jobs execute $JOB_NAME \
        --region=$REGION \
        --update-env-vars="TARGET_DATE=$date" \
        --wait
    
    if [ $? -eq 0 ]; then
        echo "✓ $date completed successfully"
    else
        echo "✗ $date failed!"
        echo "Check logs with:"
        echo "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=$JOB_NAME' --limit=50"
        
        read -p "Continue with next date? (Y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Backfill stopped."
            exit 1
        fi
    fi
    
    echo ""
done

echo "========================================"
echo "Backfill Complete!"
echo "========================================"
echo ""
echo "All dates processed. Your trade_events tables should now be up to date through Oct 28, 2025."