# Stock System - Quick Start Guide

## If You're Starting a New Chat

**Drop this entire package into the chat and say:**

> "I need help with the stock trading system. I've attached the complete package. Please review the HOW_WE_WORK_TOGETHER.md file to understand our workflow."

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

If both use addition, you'd buy and sell at the same level!

## Quick Commands

### Check if formula is correct:
```bash
grep "sellThreshold" processor/event-update-job.js
```

Should show: `baseline * (1 - sellPct / 100)`

### Check event counts:
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'trade_events_rth_equal_mean' as table_name,
  COUNT(*) as event_count
FROM trade_events_rth_equal_mean;
"
```

### Verify events are valid:
```bash
node verification_scripts/check_event_logic.js
```

## Files in This Package

1. **HOW_WE_WORK_TOGETHER.md** - Communication protocol and workflow
2. **COMPLETE_SYSTEM_GUIDE.md** - Full system documentation
3. **DATABASE_SCHEMA.sql** - All table definitions
4. **FORMULA_VERIFICATION_REPORT.md** - Analysis of all formulas
5. **processor/** - Event generation code
6. **api-server/** - API endpoints
7. **frontend-dashboard/** - React/Next.js frontend

## System Stats

- **Stocks:** 9 (HIVE, RIOT, MARA, CLSK, BTDR, CORZ, HUT, CAN, CIFR)
- **Methods:** 5 (EQUAL_MEAN, VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN)
- **Sessions:** 2 (RTH, AH)
- **Event Tables:** 10
- **Combinations:** 900 per table
- **Total Events:** 33.7M
- **Reports:** 11

## Deployment URLs

- **Frontend:** https://raas.help
- **Stock Reports:** https://raas.help/stocks
- **API:** https://api-server-neon-five.vercel.app

## Database

- **Host:** 34.41.97.179
- **Database:** tradiac_testing
- **User:** postgres
- **Password:** Fu3lth3j3t!

---

**Start with HOW_WE_WORK_TOGETHER.md for the full guide!**