# Ready to Regenerate Crypto Events - CORRECT FORMULA

## The Bug You Found

You were 100% correct! The crypto events were generated with the WRONG sell threshold formula:

### What I Told You to Paste (WRONG):
```javascript
const sellThreshold = bar.baseline * (1 + sellPct / 100);  // SAME AS BUY!
```

### What It Should Be (CORRECT):
```javascript
const sellThreshold = bar.baseline * (1 - sellPct / 100);  // BELOW BASELINE
```

## Evidence from Database

Analyzed actual ETH events:
- **Baseline:** 24.45
- **Buy Threshold:** 24.70 (baseline × 1.01) ✓
- **Sell Threshold:** 24.21 (baseline × 0.99) ✓

**But SELL events triggered at:**
- Ratio 24.69 (should NOT sell - way above 24.21!)
- Ratio 24.70 (should NOT sell - way above 24.21!)

This created ~66M events instead of the expected ~30-40M.

## What I've Prepared

### 1. Correct Script
Created `CORRECT_crypto_event_generation.js` with the proper formula.

### 2. Automated Regeneration Script
Created `REGENERATE_CRYPTO_EVENTS_CORRECT.sh` that will:
1. Clear all crypto event tables (~66M events)
2. Create correct script in Cloud Shell
3. Build Docker image
4. Deploy Cloud Run job
5. Execute both methods (EQUAL_MEAN, WINSORIZED)

### 3. All Files Updated
- ✅ `CORRECT_crypto_event_generation.js` - Standalone correct version
- ✅ `cloudshell_crypto/crypto-event-generation.js` - Already correct
- ✅ `processor/crypto-event-generation.js` - Already correct
- ✅ Pushed to GitHub

## How to Run

### Option 1: Use the Automated Script (Recommended)
```bash
# Copy the script to your machine
# Then run:
bash REGENERATE_CRYPTO_EVENTS_CORRECT.sh
```

This will do everything automatically.

### Option 2: Manual Steps (If you prefer)
I can provide the individual command blocks like before, but with the CORRECT formula this time.

## Expected Results

### Before (Wrong Formula):
- ~66M events
- SELLs trigger when ratio drops below BUY threshold
- Too many trades, incorrect returns

### After (Correct Formula):
- ~30-40M events (50% fewer)
- SELLs trigger when ratio drops below SELL threshold
- Proper trading spread, correct returns

### Example Trade:
**Baseline:** 29,520.7
- **Buy at:** 29,668.3 (baseline × 1.005)
- **Sell at:** 29,225.5 (baseline × 0.99)
- **Spread:** 442.8 points (proper trading range)

## Time Estimate
- **Clear tables:** 1 minute
- **Build & deploy:** 5 minutes
- **Generate events:** 30-40 minutes
- **Total:** ~40-45 minutes

## Verification After Regeneration

Run this to verify the fix worked:
```bash
node detailed_event_check.js
```

Should show:
- ✓ All BUY events: ratio >= buyThreshold
- ✓ All SELL events: ratio <= sellThreshold (much lower)
- Fewer total events

---

**Status:** Ready to execute
**Files:** All committed to GitHub
**Next Step:** Run the regeneration script or let me know if you want manual command blocks