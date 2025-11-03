# Crypto Events Regeneration Plan - CRITICAL BUG FIX

## Problem Confirmed

The crypto events in the database were generated with the **WRONG sell threshold formula**:

### What Was Used (WRONG):
```javascript
const sellThreshold = baseline * (1 + sellPct / 100);  // Same as buy!
```

### What Should Be Used (CORRECT):
```javascript
const sellThreshold = baseline * (1 - sellPct / 100);  // Lower than baseline
```

## Evidence

Analyzed ETH events for 2024-10-01 with 1.0% buy/sell:
- **Baseline:** 24.4543
- **Correct Buy Threshold:** 24.6988 (baseline * 1.01)
- **Correct Sell Threshold:** 24.2097 (baseline * 0.99)

**But SELL events triggered at:**
- Ratio 24.6923 (should NOT sell - above 24.2097)
- Ratio 24.6926 (should NOT sell - above 24.2097)
- Ratio 24.6964 (should NOT sell - above 24.2097)

All SELLs triggered when ratio dropped below BUY threshold, not SELL threshold!

## Impact

This bug causes:
- **Way too many events** (selling too early, buying again immediately)
- **Incorrect returns** (not holding long enough for proper profit)
- **Invalid strategy testing** (not following the actual trading logic)

## Current Code Status

Checked the deployment files:
- ✅ `cloudshell_crypto/crypto-event-generation.js` - HAS CORRECT FORMULA
- ✅ `processor/crypto-event-generation.js` - HAS CORRECT FORMULA

**BUT** the data in the database was generated with the WRONG formula, meaning an older/different version was deployed.

## Regeneration Steps

### 1. Verify Current Code is Correct ✅
```bash
grep "sellThreshold" cloudshell_crypto/crypto-event-generation.js
# Should show: const sellThreshold = baseline * (1 - sellPct / 100);
```

### 2. Clear All Crypto Event Tables
```sql
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
```

This will delete ~66M events (21 symbols × 2 methods × ~1.5M events each)

### 3. Redeploy Cloud Run Job
```bash
cd cloudshell_crypto
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generation
gcloud run jobs update crypto-event-job-equal-mean \
  --image gcr.io/tradiac-testing/crypto-event-generation:latest \
  --region us-central1

gcloud run jobs update crypto-event-job-winsorized \
  --image gcr.io/tradiac-testing/crypto-event-generation:latest \
  --region us-central1
```

### 4. Execute Both Jobs
```bash
# EQUAL_MEAN
gcloud run jobs execute crypto-event-job-equal-mean \
  --region us-central1 \
  --update-env-vars METHOD=EQUAL_MEAN

# WINSORIZED  
gcloud run jobs execute crypto-event-job-winsorized \
  --region us-central1 \
  --update-env-vars METHOD=WINSORIZED
```

### 5. Expected Results

With CORRECT formula:
- **Fewer events** (proper buy/sell spread)
- **Better returns** (holding positions longer)
- **Correct logic** (sell when ratio drops below baseline - sell%, not when it drops below baseline + buy%)

**Estimated time:** 30-40 minutes for both jobs to complete

### 6. Verification

After regeneration, run the same check:
```bash
node detailed_event_check.js
```

Should show:
- ✓ All BUY events: ratio >= buyThreshold
- ✓ All SELL events: ratio <= sellThreshold (much lower than current)
- Fewer total events (proper trading spread)

## Example of Correct Logic

**Baseline:** 29,520.7
**Buy %:** 0.5%
**Sell %:** 1.0%

**Buy Threshold:** 29,520.7 × 1.005 = 29,668.3
**Sell Threshold:** 29,520.7 × 0.99 = 29,225.5

**Trading Logic:**
- If ratio > 29,668.3 → BUY
- If ratio < 29,225.5 → SELL
- Otherwise → HOLD

This creates a proper spread where you buy high and sell when it drops significantly.

## Files to Check Before Regeneration

1. `cloudshell_crypto/crypto-event-generation.js` - Main deployment file
2. `cloudshell_crypto/Dockerfile` - Ensure it copies the correct file
3. Verify no environment variables override the formula

---

**Status:** Ready to regenerate
**Action Required:** User confirmation to proceed with deletion and regeneration
**Estimated Time:** 30-40 minutes
**Expected Outcome:** ~30-40M events (down from 66M) with correct logic