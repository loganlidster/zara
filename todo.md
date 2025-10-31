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

### 3. Fix Wallet Loading in Real vs Projected [BLOCKED - NEEDS BACKEND DEPLOYMENT]
- [x] Debug why wallet dropdown is not loading
  - FOUND: Backend not deployed yet, still running old code
  - Error: Trying to connect with user 'postgres' instead of 'appuser'
  - live-db.js has correct config but not deployed
- [ ] **USER ACTION: Deploy backend to Cloud Run**
- [ ] Verify wallets-endpoint works after deployment
- [ ] Test wallet selection and data loading

### 4. Deploy and Test [IN PROGRESS - BUILD RUNNING]
- [x] **USER: Triggered backend deployment**
  - Build ID: 8a8e7342 (running)
  - Trigger: tradiac-auto-deploy
  - Branch: main
  - Status: Building...
  - Wait 3-5 minutes for completion
  
After deployment completes, test:
- [ ] Multi-Stock with 3 stocks - verify ROI is reasonable (-100% to +100%)
- [ ] Compare Multi-Stock results with Daily Curve - should match exactly
- [ ] Test separate RTH/AH methods (e.g., EQUAL_MEAN for RTH, VWAP_RATIO for AH)
- [ ] Test "Load Live Settings" button with 11 stocks
- [ ] Real vs Projected - verify wallets load from tradiac database
- [ ] Real vs Projected - verify wallet dropdown populates