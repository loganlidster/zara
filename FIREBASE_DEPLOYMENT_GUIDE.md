# 🚀 Firebase Deployment Guide for TRADIAC.CO

## Prerequisites
✅ Baselines calculated
✅ Local testing complete
✅ GoDaddy domain: tradiac.co

## Step 1: Install Firebase CLI

```powershell
npm install -g firebase-tools
```

## Step 2: Login to Firebase

```powershell
firebase login
```

This opens your browser to authenticate with Google.

## Step 3: Deploy to Firebase

Just double-click: **`deploy-to-firebase.bat`**

This will:
1. Build the web UI for production
2. Deploy to Firebase Hosting
3. Give you a live URL: `https://tradiac-testing.web.app`

## Step 4: Connect Custom Domain (tradiac.co)

### In Firebase Console:

1. Go to: https://console.firebase.google.com
2. Select project: **tradiac-testing**
3. Click **Hosting** in left menu
4. Click **Add custom domain**
5. Enter: **tradiac.co**
6. Firebase will give you DNS records

### In GoDaddy:

1. Go to: https://dnsmanagement.godaddy.com
2. Find domain: **tradiac.co**
3. Click **DNS** → **Manage Zones**
4. Add the DNS records Firebase gave you:

**A Records (for root domain):**
```
Type: A
Name: @
Value: [Firebase IP addresses - they'll give you these]
TTL: 1 Hour
```

**CNAME Record (for www):**
```
Type: CNAME
Name: www
Value: tradiac-testing.web.app
TTL: 1 Hour
```

5. Click **Save**

### Wait for DNS Propagation

- Usually takes 5-60 minutes
- Sometimes up to 24 hours
- Check status in Firebase Console

## Step 5: Deploy API to Cloud Run

The frontend will be on Firebase, but the API needs to be on Cloud Run.

```powershell
cd api-server
gcloud run deploy tradiac-api --source . --region us-central1 --allow-unauthenticated
```

This gives you an API URL like: `https://tradiac-api-xxxxx-uc.a.run.app`

## Step 6: Update Frontend to Use Production API

Edit `web-ui/src/pages/FastDaily/FastDaily.jsx` and other components:

Change:
```javascript
fetch('http://localhost:3001/api/fast-daily', ...)
```

To:
```javascript
fetch('https://tradiac-api-xxxxx-uc.a.run.app/api/fast-daily', ...)
```

Or better yet, use environment variables:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
fetch(`${API_URL}/api/fast-daily`, ...)
```

## Step 7: Set Up Environment Variables

Create `web-ui/.env.production`:
```
VITE_API_URL=https://tradiac-api-xxxxx-uc.a.run.app
```

Create `web-ui/.env.development`:
```
VITE_API_URL=http://localhost:3001
```

## Step 8: Redeploy with Production API

```powershell
deploy-to-firebase.bat
```

## Step 9: Test Production Site

1. Go to: **https://tradiac.co**
2. Test all features:
   - Single Simulation
   - Batch Grid Search
   - Batch Daily
   - Fast Daily Report
3. Verify API calls work
4. Check performance

## Troubleshooting

### Domain not working?
- Check DNS propagation: https://dnschecker.org
- Verify DNS records in GoDaddy match Firebase requirements
- Wait up to 24 hours for full propagation

### API calls failing?
- Check Cloud Run logs: `gcloud run logs read tradiac-api`
- Verify CORS settings in API server
- Check API URL in frontend code

### Build errors?
- Run `npm install` in both api-server and web-ui
- Clear node_modules and reinstall
- Check for TypeScript/ESLint errors

## Cost Estimate

**Firebase Hosting:**
- Free tier: 10 GB storage, 360 MB/day transfer
- Likely free for your usage

**Cloud Run (API):**
- Pay per request
- Estimated: $5-20/month depending on usage

**Cloud SQL (Database):**
- Already running: ~$50/month

**Total: ~$55-70/month**

## Auto-Deploy with GitHub Actions (Optional)

We can set up automatic deployment on every push to main branch.

Let me know if you want this!

---

## Quick Commands Reference

**Deploy to Firebase:**
```powershell
deploy-to-firebase.bat
```

**Deploy API to Cloud Run:**
```powershell
cd api-server
gcloud run deploy tradiac-api --source . --region us-central1 --allow-unauthenticated
```

**Check deployment status:**
```powershell
firebase hosting:channel:list
```

**View logs:**
```powershell
gcloud run logs read tradiac-api --limit 50
```

---

**Ready to deploy?** Just run `deploy-to-firebase.bat`! 🚀