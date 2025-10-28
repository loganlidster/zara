# Vercel Deployment - Root Directory Issue Workaround

## Problem
Vercel's UI is not showing `frontend-dashboard` in the root directory dropdown (showing cached data).

## ✅ Confirmed: Files ARE on GitHub
The `frontend-dashboard` directory was successfully pushed in commit `bbd31c8`.

---

## Solution: Manual Root Directory Entry

Instead of selecting from the dropdown, **type it manually**:

### Steps:

1. **Import Repository** in Vercel as normal
2. When you get to the configuration screen
3. Look for **"Root Directory"** section
4. Click the **"Edit"** button next to it
5. **Type manually**: `frontend-dashboard`
6. Press Enter or click outside the field
7. Continue with deployment

---

## Alternative: Refresh Vercel's Cache

If manual entry doesn't work:

1. **Cancel the import**
2. Go to Vercel Settings → Git Integration
3. **Disconnect** the repository
4. **Reconnect** the repository
5. Try importing again (Vercel will refresh the file list)

---

## Alternative 2: Use Vercel CLI (Fastest)

If the UI continues to have issues, use the command line:

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to dashboard directory
cd frontend-dashboard

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: tradiac-dashboard (or whatever you want)
# - Directory: ./ (current directory)
# - Deploy? Yes

# Add custom domain
vercel domains add raas.help
```

This bypasses the UI entirely and deploys directly.

---

## What's Happening
Vercel's UI caches the repository structure when you first connect. Since `frontend-dashboard` was just added, it's not in the cache yet. Manual entry or CLI deployment works around this.

---

## Recommended Approach
Try **manual entry** first (type `frontend-dashboard` in the Root Directory field). If that doesn't work, use the **Vercel CLI** method - it's actually faster anyway!