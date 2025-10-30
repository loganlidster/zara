#!/bin/bash

# Get the service account credentials from environment
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
    echo "Error: GOOGLE_APPLICATION_CREDENTIALS_JSON not set"
    exit 1
fi

# Save to temp file
echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/sa-key.json

# Get OAuth token
TOKEN=$(python3 -c "
import json
import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account

with open('/tmp/sa-key.json') as f:
    key_data = json.load(f)

credentials = service_account.Credentials.from_service_account_info(
    key_data,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)

auth_req = google.auth.transport.requests.Request()
credentials.refresh(auth_req)
print(credentials.token)
")

if [ -z "$TOKEN" ]; then
    echo "Failed to get OAuth token"
    exit 1
fi

echo "Got OAuth token"

# Trigger Cloud Build
PROJECT_ID="tradiac-testing"
REPO_NAME="github_loganlidster_zara"

BUILD_CONFIG='{
  "source": {
    "repoSource": {
      "projectId": "'$PROJECT_ID'",
      "repoName": "'$REPO_NAME'",
      "branchName": "main"
    }
  },
  "steps": [
    {
      "name": "gcr.io/cloud-builders/docker",
      "args": [
        "build",
        "-t", "gcr.io/'$PROJECT_ID'/tradiac-api:latest",
        "-f", "api-server/Dockerfile",
        "."
      ]
    },
    {
      "name": "gcr.io/cloud-builders/docker",
      "args": ["push", "gcr.io/'$PROJECT_ID'/tradiac-api:latest"]
    },
    {
      "name": "gcr.io/google.com/cloudsdktool/cloud-sdk",
      "entrypoint": "gcloud",
      "args": [
        "run", "deploy", "tradiac-api",
        "--image", "gcr.io/'$PROJECT_ID'/tradiac-api:latest",
        "--region", "us-central1",
        "--platform", "managed",
        "--allow-unauthenticated"
      ]
    }
  ],
  "timeout": "1200s"
}'

echo "Triggering Cloud Build..."

RESPONSE=$(curl -s -X POST \
  "https://cloudbuild.googleapis.com/v1/projects/$PROJECT_ID/builds" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BUILD_CONFIG")

BUILD_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('metadata', {}).get('build', {}).get('id', 'unknown'))")

if [ "$BUILD_ID" != "unknown" ]; then
    echo "Build triggered successfully!"
    echo "Build ID: $BUILD_ID"
    echo "View build: https://console.cloud.google.com/cloud-build/builds/$BUILD_ID?project=$PROJECT_ID"
else
    echo "Error triggering build:"
    echo "$RESPONSE" | python3 -m json.tool
fi

# Cleanup
rm -f /tmp/sa-key.json