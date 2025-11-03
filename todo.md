# Update Crypto Reports Date Format

## Task
Change date display in crypto reports from UTC timestamp to MM/DD/YYYY format

## Current Issue
- Dates showing as: "2025-10-26T00:00:00.000Z"
- Hard to read and takes up too much space
- Need: "10/26/2025"

## Files to Update
- [x] Crypto Daily Curve report API endpoint
- [x] Crypto Fast Daily report API endpoint (crypto-fast-daily-events.js)
- [x] Crypto Grid Search report API endpoint
- [x] Crypto Best Performers endpoint
- [x] All crypto simple endpoints

## SQL Change Needed
Replace date columns with:
```sql
TO_CHAR(date_column, 'MM/DD/YYYY') as formatted_date
```

## Steps
1. [x] Find all crypto report API endpoints
2. [x] Update SQL queries to format dates
3. [x] Update frontend threshold dropdowns to 30 values
   - [x] crypto-daily-curve-new (manual dropdowns)
   - [x] crypto-fast-daily (THRESHOLDS constant)
   - [x] crypto-fast-daily-new (queries all combos - no change needed)
   - [x] crypto-grid-search-new (queries all combos - no change needed)
4. [x] Push to GitHub (auto-deploys)
5. [ ] Wait for deployment
6. [ ] Test crypto reports
7. [ ] Verify dates display as MM/DD/YYYY
8. [ ] Verify all 30 threshold options available