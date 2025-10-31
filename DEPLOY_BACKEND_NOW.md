# Deploy Backend - Step by Step Guide

## Option 1: Google Cloud Console (Easiest)

### Step 1: Open Cloud Build
Go to: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing

### Step 2: Find Your Trigger
Look for a trigger named something like:
- `tradiac-api`
- `api-server`
- `github_loganlidster_zara`
- Or any trigger connected to your GitHub repo

### Step 3: Run the Trigger
1. Click the **RUN** button next to the trigger
2. In the dialog that appears:
   - Branch: `main`
   - Click **"Run Trigger"**
3. Wait 3-5 minutes for the build to complete

### Step 4: Verify Deployment
After the build completes, check:
- Go to: https://console.cloud.google.com/run?project=tradiac-testing
- Find `tradiac-api` service
- Check that it shows a recent deployment time

---

## Option 2: If No Trigger Exists - Create One

### Step 1: Go to Cloud Build Triggers
https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing

### Step 2: Click "CREATE TRIGGER"

### Step 3: Configure Trigger
- **Name**: `deploy-tradiac-api`
- **Event**: Push to a branch
- **Source**: 
  - Repository: `github_loganlidster_zara`
  - Branch: `^main$`
- **Configuration**: Cloud Build configuration file
- **Location**: `api-server/cloudbuild.yaml`

### Step 4: Click "CREATE"

### Step 5: Click "RUN" on the new trigger

---

## Option 3: Manual Build (If triggers don't work)

### Step 1: Open Cloud Shell
Go to: https://console.cloud.google.com/
Click the Cloud Shell icon (>_) in the top right

### Step 2: Clone Your Repo
```bash
git clone https://github.com/loganlidster/zara.git
cd zara
```

### Step 3: Build and Deploy
```bash
# Build the Docker image
gcloud builds submit \
  --config=api-server/cloudbuild.yaml \
  --project=tradiac-testing

# Or if that doesn't work, build manually:
docker build -t gcr.io/tradiac-testing/tradiac-api:latest -f api-server/Dockerfile .
docker push gcr.io/tradiac-testing/tradiac-api:latest

# Deploy to Cloud Run
gcloud run deploy tradiac-api \
  --image gcr.io/tradiac-testing/tradiac-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --project tradiac-testing
```

---

## Option 4: Quick Deploy Script

### Step 1: Open Cloud Shell
https://console.cloud.google.com/ → Click Cloud Shell icon (>_)

### Step 2: Run This Script
```bash
# Quick deploy script
cd /tmp
git clone https://github.com/loganlidster/zara.git
cd zara

# Build and deploy in one command
gcloud builds submit \
  --tag gcr.io/tradiac-testing/tradiac-api:latest \
  api-server && \
gcloud run deploy tradiac-api \
  --image gcr.io/tradiac-testing/tradiac-api:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --project tradiac-testing
```

---

## What to Expect

### During Build (3-5 minutes)
You'll see:
- ✓ Cloning repository
- ✓ Building Docker image
- ✓ Pushing to Container Registry
- ✓ Deploying to Cloud Run
- ✓ Service URL: https://tradiac-api-941257247637.us-central1.run.app

### After Deployment
Test immediately:
1. **Wallet Loading**: Go to Real vs Projected report
   - Should see wallet dropdown populate
   - No more 500 errors

2. **Multi-Stock Math**: Go to Multi-Stock Daily Curve
   - Add HIVE, RIOT, MARA
   - Set all to 0.5/0.5 thresholds
   - Run simulation
   - ROI should be reasonable (-100% to +100%)

3. **Check Logs**: 
   - Go to Cloud Run → tradiac-api → LOGS
   - Should see: `[Live DB] Connected to tradiac live database`
   - Should NOT see: `password authentication failed for user "postgres"`

---

## Troubleshooting

### If Build Fails
Check the build logs for errors:
- Go to Cloud Build → History
- Click on the failed build
- Look for error messages

### If Deployment Succeeds But Still Errors
1. Check environment variables in Cloud Run:
   - Go to Cloud Run → tradiac-api → EDIT & DEPLOY NEW REVISION
   - Verify DB_HOST, DB_USER, DB_PASSWORD are set correctly

2. Check the logs:
   - Cloud Run → tradiac-api → LOGS
   - Look for connection errors

### If You Can't Find Triggers
You may need to set up Cloud Build GitHub integration:
1. Go to Cloud Build → Triggers
2. Click "CONNECT REPOSITORY"
3. Select GitHub
4. Authorize and select your repository

---

## Need Help?
If you're stuck, share:
1. Screenshot of Cloud Build Triggers page
2. Screenshot of Cloud Run services page
3. Any error messages you see

I can guide you through the specific steps for your setup.