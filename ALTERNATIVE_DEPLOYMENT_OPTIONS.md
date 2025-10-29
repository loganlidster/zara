# Alternative Deployment Options

## Current Situation

You're having issues running the Cloud Run Job from your desktop PowerShell. Let's explore alternatives!

## Option 1: Use Cloud Scheduler Directly (Recommended)

We can set up Cloud Scheduler to trigger the job WITHOUT needing to run commands from your desktop.

### From Cloud Console (Web Browser)

1. **Go to Cloud Scheduler:**
   https://console.cloud.google.com/cloudscheduler?project=tradiac-testing

2. **Create a Job:**
   - Click "CREATE JOB"
   - Name: `event-update-manual-trigger`
   - Region: `us-central1`
   - Frequency: Leave blank (we'll trigger manually)
   - Target type: `HTTP`
   - URL: `https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/tradiac-testing/jobs/event-update-job:run`
   - HTTP method: `POST`
   - Auth header: `Add OIDC token`
   - Service account: `tradiac-testing@appspot.gserviceaccount.com`

3. **Trigger Manually:**
   - Click "FORCE RUN" button
   - This runs the job immediately!

### Advantages:
- ✅ No local commands needed
- ✅ Click a button to run
- ✅ Can set up automation later
- ✅ View logs in Cloud Console

## Option 2: Firebase Cloud Functions (Alternative)

We could create a Firebase Cloud Function that triggers the event processing. However, this has limitations:

### Pros:
- Runs in Firebase (familiar environment)
- Can be triggered via HTTP endpoint
- Easy to deploy

### Cons:
- ❌ 9-minute timeout limit (our job takes 2-3 minutes, so OK)
- ❌ Less memory than Cloud Run Jobs
- ❌ More complex setup
- ❌ Would need to rewrite the processor code

**Verdict:** Not recommended. Cloud Run Jobs is better suited for this.

## Option 3: Use Cloud Console to Trigger Job (Easiest!)

You can trigger the Cloud Run Job directly from the web browser:

### Steps:

1. **Go to Cloud Run Jobs:**
   https://console.cloud.google.com/run/jobs?project=tradiac-testing

2. **Find your job:**
   - Look for `event-update-job`

3. **Click "EXECUTE":**
   - Click the "EXECUTE" button at the top
   - In the dialog, click "Environment variables"
   - Add: `TARGET_DATE` = `2025-10-24`
   - Click "EXECUTE"

4. **View Progress:**
   - Click on the execution to see logs
   - Wait 2-3 minutes for completion

### Advantages:
- ✅ No command line needed
- ✅ Click buttons in web browser
- ✅ See logs in real-time
- ✅ Easy to use

## Option 4: API Endpoint to Trigger Job

We could create an API endpoint in your existing API server that triggers the job.

### Implementation:

Add to `api-server/server.js`:

```javascript
// Trigger event update job
app.post('/api/admin/trigger-event-update', async (req, res) => {
  const { targetDate } = req.body;
  
  try {
    const { execSync } = require('child_process');
    const command = `gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=${targetDate}`;
    
    execSync(command);
    
    res.json({ success: true, message: `Job triggered for ${targetDate}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Pros:
- ✅ Trigger from your dashboard
- ✅ No command line needed
- ✅ Can add authentication

### Cons:
- ❌ Requires API server to have gcloud credentials
- ❌ More complex setup
- ❌ Not recommended for production

## Option 5: Use Cloud Shell (Temporary)

If you're out of time on Cloud Shell, you can:

1. **Open Cloud Shell:**
   https://console.cloud.google.com/cloudshell

2. **Run commands there:**
   ```bash
   gcloud run jobs execute event-update-job --region=us-central1 --update-env-vars=TARGET_DATE=2025-10-24 --wait
   ```

### Advantages:
- ✅ No local setup needed
- ✅ Already authenticated
- ✅ Works immediately

### Disadvantages:
- ❌ Session timeout
- ❌ Need to reconnect

## Recommended Solution: Cloud Console (Option 3)

**The easiest way is to use the Cloud Console web interface:**

### For Testing (Oct 24, 25, 28):

1. Go to: https://console.cloud.google.com/run/jobs/details/us-central1/event-update-job?project=tradiac-testing

2. Click "EXECUTE" button

3. Add environment variable:
   - Name: `TARGET_DATE`
   - Value: `2025-10-24` (then `2025-10-25`, then `2025-10-28`)

4. Click "EXECUTE"

5. Watch logs in real-time

6. Verify in Fast Daily report

### For Automation (After Testing):

1. Go to: https://console.cloud.google.com/cloudscheduler?project=tradiac-testing

2. Create scheduled job:
   - Name: `event-update-daily`
   - Schedule: `0 7 * * *` (2 AM EST = 7 AM UTC)
   - Target: HTTP
   - URL: `https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/tradiac-testing/jobs/event-update-job:run`
   - Method: POST
   - Auth: OIDC token with service account

3. Done! Runs automatically every night.

## Summary

| Option | Ease of Use | Best For | Recommended |
|--------|-------------|----------|-------------|
| Cloud Console | ⭐⭐⭐⭐⭐ | Testing & Setup | ✅ YES |
| Cloud Scheduler | ⭐⭐⭐⭐ | Automation | ✅ YES |
| Cloud Shell | ⭐⭐⭐ | Quick Tests | ✅ OK |
| Firebase Functions | ⭐⭐ | Not suitable | ❌ NO |
| API Endpoint | ⭐⭐ | Complex setup | ❌ NO |
| Desktop PowerShell | ⭐⭐⭐ | If working | ✅ OK |

## My Recommendation

**Use Cloud Console for everything:**

1. **Deploy the job** (if not already done):
   - Use Cloud Build or Cloud Console
   - Or fix PowerShell and run `.\setup-event-job.ps1`

2. **Test manually** (Oct 24, 25, 28):
   - Use Cloud Console "EXECUTE" button
   - Add TARGET_DATE environment variable
   - Watch logs in browser

3. **Set up automation**:
   - Use Cloud Scheduler in Cloud Console
   - Schedule for 2 AM EST daily
   - Done!

**No command line needed!** Everything can be done in your web browser.

---

## Quick Links

- **Cloud Run Jobs:** https://console.cloud.google.com/run/jobs?project=tradiac-testing
- **Cloud Scheduler:** https://console.cloud.google.com/cloudscheduler?project=tradiac-testing
- **Cloud Build:** https://console.cloud.google.com/cloud-build?project=tradiac-testing
- **Logs:** https://console.cloud.google.com/logs?project=tradiac-testing

**Want me to walk you through using Cloud Console?** It's the easiest way! 🚀