#!/bin/bash
# Fix daily-update-job by adding environment variables

echo "🔧 Updating daily-update-job with environment variables..."

gcloud run jobs update daily-update-job \
  --region us-central1 \
  --set-env-vars="DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!,POLYGON_API_KEY=K_hSDwyuUSqRmD57vOlUmYqZGdcZsoG0"

echo ""
echo "✅ Environment variables added!"
echo ""
echo "Now test it:"
echo "gcloud run jobs execute daily-update-job --region us-central1 --args=&quot;TARGET_DATE=2025-10-30&quot;"