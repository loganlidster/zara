#!/bin/bash
# BLOCK 4: Execute Both Jobs in Parallel
# IMPORTANT: Use --update-env-vars (NOT --set-env-vars)

gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --update-env-vars METHOD=EQUAL_MEAN \
  --async

gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --update-env-vars METHOD=WINSORIZED \
  --async

echo "✅ Both jobs started!"
echo "Monitor at: https://console.cloud.google.com/run/jobs?project=tradiac-testing"