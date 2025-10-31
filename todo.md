# Multi-Stock Daily Curve and Real vs Projected Reports - TODO

## Current Status
- ✅ Multi-Stock Daily Curve math bug FIXED
- ✅ Code committed and pushed to GitHub (commit 77cac6c)
- ⏳ Backend deployment needed (USER ACTION REQUIRED)
- ❌ Wallet loading still not working in Real vs Projected report
- ✅ Frontend already has per-stock method selection (no changes needed)

## Priority Tasks

### 1. Fix Multi-Stock Daily Curve Math [COMPLETE - AWAITING DEPLOYMENT]
- [x] Read Daily Curve endpoint code
- [x] Read Multi-Stock Daily Curve endpoint code
- [x] Compare simulation logic line-by-line
- [x] Identify mathematical discrepancy causing inflated ROI
  - FOUND: Was fetching ALL events then filtering incorrectly
  - Should query for exact buy_pct/sell_pct like Daily Curve does
- [x] Fix query to match Daily Curve (use WHERE buy_pct = X AND sell_pct = Y)
- [x] Remove incorrect filtering logic
- [x] Add filterToAlternating() function to match Daily Curve
- [x] Commit and push changes to GitHub
- [ ] **USER ACTION: Deploy backend to Cloud Run**
- [ ] Test with same settings as Daily Curve to verify identical results

### 2. Per-Stock Baseline Method Selection [IN PROGRESS]
- [ ] Add separate RTH method dropdown per stock
- [ ] Add separate AH method dropdown per stock
- [ ] Update StockConfig interface to include rthMethod and ahMethod
- [ ] Update backend to query different tables based on session-specific methods
- [ ] Test with different methods for RTH vs AH

### 3. Fix Wallet Loading in Real vs Projected [NOT STARTED]
- [ ] Debug why wallet dropdown is not loading
- [ ] Check database connection to live database
- [ ] Verify wallets-endpoint is working
- [ ] Test wallet selection and data loading

### 4. Deploy and Test [WAITING ON USER]
- [ ] **USER: Trigger Cloud Build deployment**
- [ ] Test Multi-Stock with 3 stocks using same settings
- [ ] Verify ROI values are reasonable (-100% to +100%)
- [ ] Compare with Daily Curve report - results should match
- [ ] Test Real vs Projected with loaded wallets (after fixing wallet loading)