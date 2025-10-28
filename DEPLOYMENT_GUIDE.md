# RAAS Deployment Guide

## Token-Based Deployment (Current Method)

We've switched from GitHub integration to token-based deployment for more reliable deployments.

### Vercel Token
- **Token**: Stored in `VERCEL_TOKEN.txt` (keep this file secure!)
- **Token Value**: `zHtms0PFOh0aVswV1MbjzLr5`

## Frontend Deployment

### Quick Deploy (Recommended)

**Linux/Mac:**
```bash
cd frontend-dashboard
./deploy.sh
```

**Windows PowerShell:**
```powershell
cd frontend-dashboard
.\deploy.ps1
```

### Manual Deploy
```bash
cd frontend-dashboard
npx vercel --prod --token=zHtms0PFOh0aVswV1MbjzLr5 --yes
```

### Deployment URLs
- **Production**: https://raas.help
- **Vercel Dashboard**: https://vercel.com/logans-projects-57bfdedc/frontend-dashboard

## Backend Deployment

Backend still uses Cloud Build auto-deployment:
1. Push to GitHub main branch
2. Cloud Build automatically deploys to Cloud Run
3. Live at: https://tradiac-api-941257247637.us-central1.run.app

## Workflow

### Making Frontend Changes
1. Edit files in `frontend-dashboard/`
2. Test locally: `npm run dev`
3. Commit to git: `git add -A && git commit -m "description"`
4. Push to GitHub: `git push`
5. Deploy to Vercel: `./deploy.sh` (or `.\deploy.ps1` on Windows)

### Making Backend Changes
1. Edit files in `api-server/`
2. Commit to git: `git add -A && git commit -m "description"`
3. Push to GitHub: `git push`
4. Cloud Build auto-deploys (takes ~2-3 minutes)

## Why Token-Based Deployment?

GitHub integration wasn't triggering automatic deployments. Token-based deployment:
- ✅ More reliable
- ✅ Faster (no waiting for webhooks)
- ✅ Direct control over when to deploy
- ✅ Works every time

## Security Note

The `VERCEL_TOKEN.txt` file contains sensitive credentials. Keep it secure and never commit it to public repositories.