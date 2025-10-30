# Quick Start Testing Guide

After backend deployment completes, follow these steps to test the new features.

## 1. Best Performers - Multi-Select (2 minutes)

### Test Steps:
1. Go to: https://your-frontend-url.vercel.app/reports/best-performers
2. You should see individual symbol buttons (HIVE, RIOT, MARA, etc.)
3. Click on 3 symbols to select them (they turn blue)
4. Set date range (e.g., last week)
5. Click "Find Best Performers"

### Expected Results:
- ✅ Results table shows combinations from all 3 selected symbols
- ✅ Symbol column shows mix of your selected symbols
- ✅ No error messages

### If It Fails:
- Check browser console for errors
- Verify backend deployment completed
- Try with just 1 symbol first

## 2. Best Performers - Per-Stock View (2 minutes)

### Test Steps:
1. On the same Best Performers page
2. Keep 3 symbols selected
3. Select "Top Performers Per Stock" radio button
4. Click "Find Best Performers"

### Expected Results:
- ✅ Results show separate tables for each symbol
- ✅ Each table has a header with the symbol name
- ✅ Each table shows top performers for that specific symbol
- ✅ You can see results for all symbols, not just CAN

### If It Fails:
- Check if "Overall" mode works first
- Verify backend received viewMode parameter
- Check Cloud Run logs for errors

## 3. Daily Curve - Session-Specific Baselines (3 minutes)

### Test Steps:
1. Go to: https://your-frontend-url.vercel.app/reports/daily-curve
2. Select 2-3 symbols
3. Select Method: "EQUAL_MEAN"
4. Select Session: "ALL"
5. **Uncheck** "Use same values for RTH and AH"
6. Enter different values:
   - RTH Buy %: 3.0
   - RTH Sell %: 0.8
   - AH Buy %: 2.5
   - AH Sell %: 0.5
7. Set date range (e.g., last 2 weeks)
8. Click "Generate Curve"

### Expected Results:
- ✅ Chart displays without errors
- ✅ Equity curves show for all selected symbols
- ✅ No "missing parameters" error
- ✅ Results look reasonable (not all zeros or NaN)

### If It Fails:
- Try with "Use same values" checked first
- Verify session is set to "ALL"
- Check browser console for errors
- Check Cloud Run logs for backend errors

## Quick Troubleshooting

### Frontend Issues
- **Clear browser cache**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Try incognito mode**: Rules out caching issues
- **Check console**: F12 → Console tab for JavaScript errors

### Backend Issues
- **Check Cloud Run logs**: https://console.cloud.google.com/run/detail/us-central1/tradiac-api/logs
- **Verify deployment**: Check Cloud Build completed successfully
- **Test API directly**: Use browser network tab to see API responses

### Common Issues

**"No results found"**
- Check date range has trading days
- Verify symbols are correct
- Try with single symbol first

**"Missing parameters" error**
- Verify all required fields are filled
- Check browser console for details
- Try refreshing the page

**Chart not displaying**
- Check if data was returned (network tab)
- Verify no JavaScript errors
- Try different date range

## Success Criteria

All features working if:
- ✅ Can select multiple symbols in Best Performers
- ✅ Per-stock view shows separate tables for each symbol
- ✅ Daily Curve works with different RTH/AH thresholds
- ✅ No console errors
- ✅ Results look reasonable

## Report Issues

If you encounter problems:
1. Note which test failed
2. Check browser console for errors
3. Check Cloud Run logs
4. Document steps to reproduce
5. Include screenshots if helpful

## Estimated Testing Time

- Best Performers Multi-Select: 2 minutes
- Best Performers Per-Stock: 2 minutes  
- Daily Curve Session-Specific: 3 minutes
- **Total: ~7 minutes**