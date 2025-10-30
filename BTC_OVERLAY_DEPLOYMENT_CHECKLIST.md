# BTC Overlay Report - Deployment Checklist

## Pre-Deployment Testing

### Backend Testing
- [ ] Start local API server: `cd api-server && npm run dev`
- [ ] Run test script: `./test-btc-overlay-endpoints.sh`
- [ ] Verify all 3 endpoints return success
- [ ] Test with different symbols (RIOT, MARA, CLSK)
- [ ] Test with different date ranges
- [ ] Test with different session types (RTH, AH, ALL)
- [ ] Test error cases (invalid dates, missing data)
- [ ] Check console logs for errors

### Frontend Testing
- [ ] Start local frontend: `cd frontend-dashboard && npm run dev`
- [ ] Navigate to `http://localhost:3000/reports/btc-overlay`
- [ ] Test "Load Data" button
- [ ] Verify chart displays correctly
- [ ] Test "Run Simulation" button
- [ ] Verify summary statistics display
- [ ] Verify trade list displays
- [ ] Test CSV export
- [ ] Test all session types (RTH, AH, ALL)
- [ ] Test session-specific thresholds (ALL mode)
- [ ] Test error handling (invalid inputs)
- [ ] Test responsive design (mobile, tablet, desktop)

### Integration Testing
- [ ] Test full workflow: Load → Simulate → Export
- [ ] Test with multiple symbols
- [ ] Test with multiple date ranges
- [ ] Verify calculations match expected results
- [ ] Compare with Streamlit app results (if available)

## Backend Deployment (Cloud Run)

### 1. Prepare for Deployment
- [ ] Commit all changes to git
- [ ] Push to GitHub repository
- [ ] Verify all files are committed:
  ```bash
  git status
  git add api-server/btc-overlay-data-endpoint.js
  git add api-server/baseline-values-endpoint.js
  git add api-server/simulate-trades-detailed-endpoint.js
  git add api-server/server.js
  git commit -m "Add BTC Overlay Report endpoints"
  git push origin main
  ```

### 2. Deploy to Cloud Run
- [ ] Navigate to api-server directory
- [ ] Build Docker image (if using Docker)
- [ ] Deploy to Cloud Run:
  ```bash
  gcloud run deploy api-server \
    --source . \
    --region us-central1 \
    --allow-unauthenticated
  ```
- [ ] Note the deployed URL
- [ ] Test endpoints on production URL

### 3. Verify Deployment
- [ ] Test `/api/btc-overlay-data` endpoint
- [ ] Test `/api/baseline-values` endpoint
- [ ] Test `/api/simulate-trades-detailed` endpoint
- [ ] Check Cloud Run logs for errors
- [ ] Verify database connectivity

## Frontend Deployment (Vercel)

### 1. Update Environment Variables
- [ ] Add production API URL to Vercel:
  ```
  NEXT_PUBLIC_API_URL=https://your-api-url.run.app
  ```

### 2. Add Navigation Link
- [ ] Edit navigation component to add link to `/reports/btc-overlay`
- [ ] Test navigation locally
- [ ] Commit changes

### 3. Deploy to Vercel
- [ ] Push changes to GitHub
- [ ] Vercel auto-deploys from main branch
- [ ] Or manually deploy:
  ```bash
  cd frontend-dashboard
  vercel --prod
  ```
- [ ] Note the deployed URL

### 4. Verify Deployment
- [ ] Navigate to production URL
- [ ] Test full workflow
- [ ] Verify API calls work
- [ ] Check browser console for errors
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices

## Post-Deployment

### 1. Smoke Testing
- [ ] Load report page
- [ ] Select RIOT, 2024-10-24 to 2024-10-29, RTH
- [ ] Click "Load Data"
- [ ] Verify chart displays
- [ ] Click "Run Simulation"
- [ ] Verify results display
- [ ] Export CSV and verify contents

### 2. Performance Testing
- [ ] Test with large date ranges (30+ days)
- [ ] Monitor API response times
- [ ] Check for memory leaks
- [ ] Verify chart performance

### 3. User Acceptance Testing
- [ ] Share with test users
- [ ] Gather feedback
- [ ] Document any issues
- [ ] Create tickets for improvements

## Success Criteria

✅ All endpoints return 200 status
✅ Frontend loads without errors
✅ Charts display correctly
✅ Simulations complete successfully
✅ CSV export works
✅ No console errors
✅ Performance acceptable (< 3s for simulation)
✅ Mobile responsive
✅ Cross-browser compatible

## Deployment Sign-Off

- [ ] Backend deployed and tested
- [ ] Frontend deployed and tested
- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring configured

**Deployed By:** _________________
**Date:** _________________
**Version:** v1.0
**Status:** ☐ Success ☐ Issues Found ☐ Rolled Back