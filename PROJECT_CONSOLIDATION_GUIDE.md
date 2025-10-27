# Project Consolidation Guide

## Current Situation

You have **two Google Cloud projects** with similar names:

1. **`tradiac-testing`** (Project ID: `tradiac-testing`)
2. **`tradiac-testing-66f6e`** (Project ID: `tradiac-testing-66f6e`)

## Recommended Configuration

Use **`tradiac-testing-66f6e`** for everything. This is already configured in:
- ✅ Firebase (`.firebaserc`)
- ✅ Cloud Build (now updated in `cloudbuild.yaml`)

## Steps to Consolidate

### 1. Verify Cloud Build Trigger Location

Check which project has the Cloud Build trigger:

**Option A: Check `tradiac-testing-66f6e`**
- Go to: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing-66f6e
- Look for a trigger connected to your GitHub repo

**Option B: Check `tradiac-testing`**
- Go to: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing
- Look for a trigger connected to your GitHub repo

### 2. If Trigger is in Wrong Project

If the trigger is in `tradiac-testing` (not `tradiac-testing-66f6e`):

1. **Create new trigger in `tradiac-testing-66f6e`**:
   - Go to: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing-66f6e
   - Click "Create Trigger"
   - Connect to your GitHub repository
   - Set branch: `main`
   - Set build configuration: `cloudbuild.yaml`
   - Save

2. **Delete old trigger in `tradiac-testing`**:
   - Go to: https://console.cloud.google.com/cloud-build/triggers?project=tradiac-testing
   - Delete the old trigger

### 3. Verify Cloud Run Service Location

Check where your API is deployed:

**Option A: Check `tradiac-testing-66f6e`**
- Go to: https://console.cloud.google.com/run?project=tradiac-testing-66f6e
- Look for `tradiac-api` service

**Option B: Check `tradiac-testing`**
- Go to: https://console.cloud.google.com/run?project=tradiac-testing
- Look for `tradiac-api` service

### 4. Current Deployment Status

After the latest push (commit `11195be`), Cloud Build will deploy to `tradiac-testing-66f6e`.

**Your buy/sell logic fix is already deployed** - just verify which project it's in!

## Quick Check Commands

To see where everything is deployed, check:

1. **Cloud Build History**:
   - Project 1: https://console.cloud.google.com/cloud-build/builds?project=tradiac-testing-66f6e
   - Project 2: https://console.cloud.google.com/cloud-build/builds?project=tradiac-testing

2. **Cloud Run Services**:
   - Project 1: https://console.cloud.google.com/run?project=tradiac-testing-66f6e
   - Project 2: https://console.cloud.google.com/run?project=tradiac-testing

## Recommendation

**Use `tradiac-testing-66f6e` for everything** and consider deleting or archiving `tradiac-testing` to avoid confusion.

## What's Already Fixed

✅ Your buy/sell logic fix is deployed (in one of these projects)
✅ Cloud Build now explicitly targets `tradiac-testing-66f6e`
✅ Firebase is configured for `tradiac-testing-66f6e`

Just verify which project has the active deployment and you're good to test!