# Event-Based System Deployment Checklist

## Pre-Deployment Verification

- [x] Database schema created (`database/create_event_tables.sql`)
- [x] Event processor implemented (`processor/event-based-processor.js`)
- [x] API endpoints implemented (`api-server/event-endpoints.js`)
- [x] API integration complete (`api-server/server.js`)
- [x] Deployment scripts created
- [x] Testing scripts created
- [x] Documentation complete

## Deployment Steps

### Step 1: Deploy Database Schema
```bash
# Connect to Cloud SQL and run schema
gcloud sql connect tradiac-db --project=tradiac-testing --database=tradiac < database/create_event_tables.sql
```

**Verification:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('trade_events', 'simulation_metadata', 'processing_queue');

-- Should return 3 rows
```

- [ ] Tables created successfully
- [ ] Functions created successfully
- [ ] Views created successfully
- [ ] Indexes created successfully

### Step 2: Deploy API Code
```bash
# Commit and push changes
git add .
git commit -m "Add event-based trade logging system"
git push origin main

# Monitor Cloud Build
gcloud builds list --project=tradiac-testing --limit=1
```

**Verification:**
- [ ] Cloud Build triggered
- [ ] Build completed successfully
- [ ] Cloud Run service updated
- [ ] No errors in logs

### Step 3: Test API Endpoints
```bash
# Set API URL
export API_URL="https://your-cloud-run-url"

# Run tests
bash scripts/test-event-system.sh
```

**Verification:**
- [ ] Health check passes
- [ ] Metadata endpoint works
- [ ] Query endpoint works
- [ ] Summary endpoint works
- [ ] Portfolio state endpoint works
- [ ] Top performers endpoint works
- [ ] Batch summary endpoint works

### Step 4: Test Processor Locally (Small Dataset)
```bash
# Test with 1 week of data first
cd processor
node event-based-processor.js 2024-01-01 2024-01-07
```

**Verification:**
- [ ] Processor runs without errors
- [ ] Events inserted into database
- [ ] Metadata updated correctly
- [ ] Processing time reasonable (~5 minutes for 1 week)

### Step 5: Verify Test Data
```bash
# Run verification queries
gcloud sql connect tradiac-db --project=tradiac-testing --database=tradiac < scripts/verify-data.sql
```

**Verification:**
- [ ] Events exist in trade_events table
- [ ] Metadata shows completed status
- [ ] ROI calculations look reasonable
- [ ] No failed simulations
- [ ] Buy/Sell events balanced

### Step 6: Run Full Historical Backfill
```bash
# Run full backfill (this will take ~2 hours)
cd processor
node event-based-processor.js 2024-01-01 2024-12-31
```

**Verification:**
- [ ] All 165 groups processed
- [ ] 148,500 combinations completed
- [ ] ~7.4 million events inserted
- [ ] No critical errors
- [ ] Processing time < 3 hours

### Step 7: Final Verification
```bash
# Run full verification suite
gcloud sql connect tradiac-db --project=tradiac-testing --database=tradiac < scripts/verify-data.sql
```

**Verification:**
- [ ] Total events: ~7.4 million
- [ ] All symbols present (11)
- [ ] All methods present (5)
- [ ] All sessions present (3)
- [ ] Metadata shows 148,500 completed
- [ ] ROI distribution looks normal
- [ ] Top performers identified
- [ ] No failed simulations

### Step 8: Test API with Real Data
```bash
# Test various queries
export API_URL="https://your-cloud-run-url"

# Test single query
curl "$API_URL/api/events/summary?symbol=HIVE&method=EQUAL_MEAN&session=RTH&buyPct=0.5&sellPct=0.5&startDate=2024-01-01&endDate=2024-12-31"

# Test top performers
curl "$API_URL/api/events/top-performers?startDate=2024-01-01&endDate=2024-12-31&limit=10"
```

**Verification:**
- [ ] Queries return data
- [ ] Response times < 2 seconds
- [ ] Data looks accurate
- [ ] No errors in logs

## Post-Deployment Tasks

### Immediate
- [ ] Update frontend to add event-based query option
- [ ] Document new endpoints for frontend team
- [ ] Monitor API performance for 24 hours
- [ ] Check Cloud Run logs for errors

### This Week
- [ ] Compare results with old system
- [ ] Gather user feedback
- [ ] Optimize slow queries if needed
- [ ] Add caching if needed

### Next Week
- [ ] Set up nightly automation
- [ ] Configure Cloud Scheduler
- [ ] Set up monitoring alerts
- [ ] Create backup strategy

## Rollback Plan

If issues occur:

1. **API Issues:**
   ```bash
   # Revert to previous Cloud Run revision
   gcloud run services update-traffic tradiac-api \
     --to-revisions=PREVIOUS_REVISION=100 \
     --project=tradiac-testing
   ```

2. **Database Issues:**
   ```sql
   -- Drop new tables if needed
   DROP TABLE IF EXISTS trade_events CASCADE;
   DROP TABLE IF EXISTS simulation_metadata CASCADE;
   DROP TABLE IF EXISTS processing_queue CASCADE;
   ```

3. **Data Issues:**
   - Old system still running
   - No data loss
   - Can reprocess at any time

## Success Criteria

- [x] All code implemented
- [ ] Database schema deployed
- [ ] API deployed and tested
- [ ] Historical data backfilled
- [ ] All verification checks pass
- [ ] Performance meets expectations
- [ ] No critical errors

## Notes

- Keep old system running during transition
- Monitor performance closely
- Be ready to rollback if needed
- Document any issues encountered
- Update documentation as needed

## Contact

If issues arise:
1. Check logs: `gcloud logs read --project=tradiac-testing`
2. Check database: `gcloud sql connect tradiac-db`
3. Review documentation: `EVENT_BASED_SYSTEM.md`
4. Check implementation: `IMPLEMENTATION_SUMMARY.md`