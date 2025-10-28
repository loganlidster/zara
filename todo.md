# Add Separate RTH/AH Values Support

## 1. API Endpoint Updates
- [x] Update /api/events/query to accept rthBuyPct, rthSellPct, ahBuyPct, ahSellPct
- [x] Update /api/events/summary to handle separate values
- [x] Add logic to query both RTH and AH tables when using "ALL" session
- [x] Combine results from both tables chronologically
- [x] Created event-endpoints-with-separate-values.js
- [x] Updated server.js to use new endpoints

## 2. Frontend Updates
- [ ] Update Fast Daily form to show separate RTH/AH inputs
- [ ] Add toggle for "Use same values for both sessions"
- [ ] Update API client to send separate parameters
- [ ] Update wallet simulation to handle combined RTH+AH data

## 3. Testing
- [ ] Test API with same values for both sessions
- [ ] Test API with different values for RTH and AH
- [ ] Verify chronological ordering of combined results
- [ ] Test wallet simulation accuracy

## 4. Deploy
- [ ] Commit API changes
- [ ] Deploy to Cloud Run
- [ ] Test API endpoints
- [ ] Commit frontend changes
- [ ] Deploy to Vercel