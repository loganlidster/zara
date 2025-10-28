# Deploy Dashboard to raas.help via Vercel

## ✅ Dashboard Code is Now on GitHub!
- **Repo:** https://github.com/loganlidster/zara
- **Dashboard Location:** `frontend-dashboard/` directory
- **Commit:** bbd31c8

---

## Step-by-Step Deployment Guide

### Step 1: Sign Up for Vercel (2 minutes)
1. Go to: **https://vercel.com/signup**
2. Click **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub account
4. You'll be redirected to your Vercel dashboard

### Step 2: Import Your Repository (1 minute)
1. Click **"Add New..."** → **"Project"**
2. Find and select **"loganlidster/zara"** from your repositories
3. Click **"Import"**

### Step 3: Configure the Project (1 minute)
On the configuration screen, set:

**Framework Preset:** Next.js (should auto-detect)

**Root Directory:** Click "Edit" and enter:
```
frontend-dashboard
```

**Build Settings:** (should auto-fill, but verify)
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Environment Variables:** None needed (API URL is already in the code)

Click **"Deploy"**

### Step 4: Wait for Deployment (2 minutes)
- Vercel will build and deploy your dashboard
- You'll see a progress screen
- When done, you'll get a URL like: `https://zara-xxxxx.vercel.app`
- Click the URL to test your dashboard!

### Step 5: Add Custom Domain (2 minutes)
1. In your Vercel project, go to **Settings** → **Domains**
2. Enter: `raas.help`
3. Click **"Add"**
4. Vercel will show you DNS records to add

### Step 6: Update DNS in GoDaddy (5 minutes)
1. Log into **GoDaddy.com**
2. Go to **My Products** → **DNS** for raas.help
3. Add these records (Vercel will show you the exact values):

**A Record:**
- Type: A
- Name: @
- Value: `76.76.21.21`
- TTL: 600

**CNAME Record (for www):**
- Type: CNAME
- Name: www
- Value: `cname.vercel-dns.com`
- TTL: 600

4. Click **"Save"**

### Step 7: Verify Domain (1 minute)
1. Back in Vercel, click **"Verify"** next to raas.help
2. Vercel will check DNS records
3. Once verified, SSL certificate is automatically issued
4. Your dashboard is now live at **https://raas.help**!

---

## Total Time: ~15 minutes

## What You Get:
✅ Dashboard live at https://raas.help
✅ Automatic SSL certificate
✅ Automatic deployments on every git push
✅ Preview URLs for every branch
✅ Free forever (for personal projects)

---

## After Deployment:
Every time you push to the `main` branch on GitHub, Vercel will automatically:
1. Build the new version
2. Deploy it to raas.help
3. Send you a notification

No manual deployment needed ever again!

---

## Need Help?
If you get stuck at any step, let me know and I'll help you through it!