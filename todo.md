# TODO - Report Enhancement Fixes

## 1. Best Performer Report
- [x] Add multi-select for symbols (run multiple at once)
- [x] Add per-stock top performers view (not just overall winners)
- [x] Update frontend UI for multi-select
- [x] Update backend to handle multiple symbols and viewMode

## 2. Daily Curve & ROI Report  
- [x] Add session-specific baseline support for ALL mode (separate AH/RTH baselines)
- [x] Fix "ALL" mode error requiring specific symbol (was confusion with Best Performers)
- [x] Verify ALL mode works with different AH/RTH thresholds
- [x] Update backend endpoint logic
- [x] Update frontend to pass session-specific parameters

## 3. Testing & Deployment
- [ ] Commit all changes to GitHub
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Cloud Run
- [ ] Test multi-select works correctly
- [ ] Test per-stock filtering shows all symbols
- [ ] Test ALL mode with session-specific baselines