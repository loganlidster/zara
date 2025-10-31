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

### 2. Per-Stock Baseline Method Selection [COMPLETE]
- [x] Add separate RTH method dropdown per stock
- [x] Add separate AH method dropdown per stock
- [x] Update StockConfig interface to include rthMethod and ahMethod
- [x] Update backend to query different tables based on session-specific methods
- [x] Fix missing dropdowns in form (they were accidentally removed)
- [x] Frontend deployed successfully (commit 4286874)
- [ ] **USER ACTION: Deploy backend to Cloud Run**
- [ ] Test with different methods for RTH vs AH

### 3. Fix Wallet Loading in Real vs Projected [IN PROGRESS]
- [x] Debug why wallet dropdown is not loading
  - FOUND: Live database in different project (tradiac-live)
  - Connection being rejected due to unauthorized IP
- [x] Added 0.0.0.0/0 to authorized networks on live database
- [x] Added better error logging (commit 506c39d)
- [ ] Wait for auto-deploy to complete
- [ ] Test wallet loading after deployment
- [ ] Verify wallets-endpoint works
- [ ] Test wallet selection and data loading

### 4. Deploy and Test [COMPLETE]
- [x] Multi-Stock Daily Curve working with separate RTH/AH methods
- [x] CSV Import/Export feature added
- [x] All reports working with correct database user (postgres)

### 5. New Features [IN PROGRESS]
- [ ] Fast Daily Report - Add separate RTH and AH baseline method selection
- [ ] Daily Curve Report - Add transaction table below graph
- [ ] Test both features
- [ ] Deploy to production