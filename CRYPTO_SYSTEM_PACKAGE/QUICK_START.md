# Crypto System - Quick Start Guide

## If You're Starting a New Chat

**Drop this entire package into the chat and say:**

> "I need help with the crypto trading system. I've attached the complete package. Please review the HOW_WE_WORK_TOGETHER.md file to understand our workflow."

Then I'll know:
- How we communicate (3-block pattern)
- What the system does
- The critical formulas
- How to deploy
- How to verify

## The Most Important Thing to Remember

### The Critical Formula

**CORRECT:**
```javascript
const buyThreshold = baseline * (1 + buyPct / 100);   // Add for buy
const sellThreshold = baseline * (1 - sellPct / 100); // Subtract for sell
```

**WRONG (Never Use):**
```javascript
const sellThreshold = baseline * (1 + sellPct / 100); // WRONG!
```

### Why This Matters

The sell threshold must be BELOW the baseline to create a proper trading spread:
- Buy when ratio is HIGH (above baseline + buy%)
- Sell when ratio is LOW (below baseline - sell%)

If both use addition, you'd buy and sell at the same level, causing way too many events!

### The Bug We Had

I initially gave you code with the WRONG formula, which generated 66M events instead of 30-40M. The database currently has this wrong data and needs regeneration.

## Quick Commands

### Check if formula is correct:
```bash
grep "sellThreshold" ~/crypto-job-correct/crypto-event-generation.js
```

Should show: `baseline * (1 - sellPct / 100)`

### Check event counts:
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as events
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 'WINSORIZED', COUNT(*)
FROM trade_events_crypto_winsorized;
"
```

Expected: ~15-20M per method, ~30-40M total

### Verify events are valid:
```bash
node detailed_event_check.js
```

All events should show as valid (ratio >= buyThreshold for BUY, ratio <= sellThreshold for SELL)

## Files in This Package

1. **HOW_WE_WORK_TOGETHER.md** - Communication protocol and workflow
2. **COMPLETE_SYSTEM_GUIDE.md** - Full system documentation
3. **DATABASE_SCHEMA.sql** - All table definitions
4. **DEPLOYMENT_BLOCKS.txt** - The 3 blocks to paste in Cloud Shell
5. **FORMULA_VERIFICATION_REPORT.md** - Analysis of all formulas
6. **cloudshell_crypto/** - Cloud Run deployment files
7. **processor/** - Data import and baseline calculation
8. **api-server/** - API endpoints (crypto-*.js files)
9. **frontend-dashboard/app/reports/crypto-*/** - Frontend reports

## System Stats

- **Cryptos:** 21 (ETH, SOL, ADA, AVAX, etc.)
- **Methods:** 2 (EQUAL_MEAN, WINSORIZED)
- **Sessions:** None (24/7 trading)
- **Event Tables:** 2
- **Combinations:** 49 per symbol (7×7)
- **Total Events:** ~30-40M (with correct formula)
- **Reports:** 4

## Deployment URLs

- **Frontend:** https://raas.help/crypto
- **API:** https://tradiac-api-941257247637.us-central1.run.app

## Database

- **Host:** 34.41.97.179
- **Database:** tradiac_testing
- **User:** postgres
- **Password:** Fu3lth3j3t!

## Current Status

⚠️ **Database needs regeneration** - Events were generated with wrong formula

To regenerate:
1. Open DEPLOYMENT_BLOCKS.txt
2. Paste BLOCK 1 in Cloud Shell
3. Paste BLOCK 2 in Cloud Shell
4. Paste BLOCK 3 in Cloud Shell
5. Wait ~30-40 minutes
6. Verify with check scripts

## Key Differences from Stock System

1. **No sessions** - Crypto trades 24/7
2. **2 event tables** - Not 10 (no RTH/AH split)
3. **49 combinations** - Not 900 (7×7 instead of 30×30)
4. **Timestamp field** - Not separate date + time
5. **21 symbols** - More than stocks (9)
6. **2 methods** - Fewer than stocks (5)

## Thresholds

**7 values:** 0.3, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0
**Why these?**
- Start at 0.3% (covers 0.15% per-trade fees)
- Max at 5.0% (reasonable for crypto volatility)
- 7×7 = 49 combinations (manageable data volume)

---

**Start with HOW_WE_WORK_TOGETHER.md for the full guide!**
**Use DEPLOYMENT_BLOCKS.txt when you need to regenerate events!**