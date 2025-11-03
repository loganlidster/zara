# ZEC Symbol Added to Dropdowns

## Problem
- Database had 21 crypto symbols
- Frontend dropdowns only showed 20 symbols
- **ZEC was missing** from all report dropdowns

## Investigation
Ran query to compare database symbols vs frontend symbols:
- **Database:** 21 symbols (ADA, AVAX, BCH, CUSD, DAI, DOGE, ETH, HBAR, HYPE, LEO, LINK, LTC, SOL, SUI, TON, TRX, TUSD, XLM, XMR, XRP, **ZEC**)
- **Frontend:** 20 symbols (missing ZEC)

## Solution
Updated all 4 crypto report pages to include ZEC:
1. `crypto-daily-curve-new/page.tsx`
2. `crypto-fast-daily-new/page.tsx`
3. `crypto-fast-daily/page.tsx`
4. `crypto-grid-search-new/page.tsx`

## Updated Symbol List
```javascript
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DAI', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP', 'ZEC'];
```

## Deployment
- **Commit:** 24c7788 - "Add ZEC to crypto symbol dropdowns (21 total symbols)"
- **Status:** Pushed to GitHub
- **Vercel:** Auto-deploying now (~2-3 minutes)

## What to Test
Once deployed:
1. Go to any crypto report
2. Open the Symbol dropdown
3. Verify ZEC appears in the list (should be last, alphabetically)
4. Select ZEC and run a report
5. Should see data for ZEC

## Note
You mentioned 23 symbols in the database, but the query only found 21. The other 2 might be:
- In different tables (not in trade_events_crypto_equal_mean)
- Or were excluded during event generation (like SHIB was excluded due to numeric overflow)

If you need to find all symbols, we can check the minute_crypto table or other event tables.

---

**Status:** Fixed and deployed
**Total Symbols:** 21 (was 20, now includes ZEC)