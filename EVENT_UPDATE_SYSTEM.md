# Event Update System - Complete Documentation

## Overview

The Event Update System is an automated pipeline that processes daily trading data and populates the 10 specialized `trade_events` tables. This system ensures all reports continue working with fresh data.

## Architecture

### Data Flow
```
1. Daily Update Job (1 AM EST)
   ↓
   Fetches minute data from Polygon API
   ↓
   Calculates baselines (5 methods × 2 sessions × 11 symbols)
   ↓
   Stores in: minute_stock, minute_btc, baseline_daily

2. Event Update Job (2 AM EST)
   ↓
   Reads: minute_stock, minute_btc, baseline_daily
   ↓
   Simulates 900 combinations per symbol+method+session
   ↓
   Stores BUY/SELL events in 10 specialized tables
```

### 10 Specialized Tables

**RTH (Regular Trading Hours) Tables:**
- `trade_events_rth_equal_mean`
- `trade_events_rth_vwap_ratio`
- `trade_events_rth_vol_weighted`
- `trade_events_rth_winsorized`
- `trade_events_rth_weighted_median`

**AH (After Hours) Tables:**
- `trade_events_ah_equal_mean`
- `trade_events_ah_vwap_ratio`
- `trade_events_ah_vol_weighted`
- `trade_events_ah_winsorized`
- `trade_events_ah_weighted_median`

## Key Features

### 1. Alternating Signal Pattern
The system logs BUY and SELL signals in alternating pattern:
- Checks the last event to determine if expecting BUY or SELL next
- If last event was BUY → next logged event must be SELL
- If last event was SELL → next logged event must be BUY
- Frontend builds wallet from scratch starting at $10,000

### 2. Incremental Processing
- Processes ONE day at a time
- Extends existing data rather than reprocessing everything
- Prevents duplicate events with ON CONFLICT clause

### 3. Performance
- Fetches minute data once per symbol+method+session
- Simulates all 900 combinations in memory
- Expected: 2-3 minutes per day for all 10 tables
- Total: 11 symbols × 5 methods × 2 sessions × 900 combos = 99,000 simulations/day

### 4. Error Handling
- Transaction-based inserts (all or nothing per group)
- Comprehensive logging
- Continues processing even if one group fails
- Returns exit code 1 if any failures

## Files

### Core Job
- **`processor/event-update-job.js`** - Main processing script
  - Accepts TARGET_DATE environment variable
  - Defaults to yesterday if not specified
  - Processes all 110 groups (11 symbols × 5 methods × 2 sessions)

### Docker
- **`processor/Dockerfile.event-update`** - Container definition
  - Based on node:20-slim
  - Includes all dependencies
  - Configured for Cloud Run Jobs

### Deployment Scripts
- **`processor/setup-event-job.ps1`** - Windows deployment
- **`processor/setup-event-job.sh`** - Linux/Mac deployment
- Both scripts:
  - Build Docker image
  - Push to Google Container Registry
  - Deploy to Cloud Run Jobs
  - Optionally set up Cloud Scheduler

### Backfill Scripts
- **`processor/backfill-events-oct-24-28.ps1`** - Windows backfill
- **`processor/backfill-events-oct-24-28.sh`** - Linux/Mac backfill
- Process missing dates: Oct 24, 25, 28 (skip weekend)

## Deployment Instructions

### Step 1: Deploy the Job

**Windows:**
```powershell
cd processor
.\setup-event-job.ps1
```

**Linux/Mac:**
```bash
cd processor
./setup-event-job.sh
```

The script will:
1. Build Docker image
2. Push to GCR
3. Deploy to Cloud Run Jobs
4. Ask if you want to set up Cloud Scheduler

### Step 2: Test Manual Execution

Run for yesterday (default):
```bash
gcloud run jobs execute event-update-job --region=us-central1 --wait
```

Run for specific date:
```bash
gcloud run jobs execute event-update-job \
  --region=us-central1 \
  --update-env-vars=TARGET_DATE=2025-10-24 \
  --wait
```

### Step 3: Backfill Missing Data

**Windows:**
```powershell
cd processor
.\backfill-events-oct-24-28.ps1
```

**Linux/Mac:**
```bash
cd processor
./backfill-events-oct-24-28.sh
```

This will process Oct 24, 25, and 28 (skipping weekend).

### Step 4: Verify Data

Check event counts:
```sql
SELECT 'trade_events_rth_equal_mean' as table_name, COUNT(*) as event_count 
FROM trade_events_rth_equal_mean 
WHERE event_date >= '2025-10-24'
UNION ALL
SELECT 'trade_events_rth_vwap_ratio', COUNT(*) 
FROM trade_events_rth_vwap_ratio 
WHERE event_date >= '2025-10-24'
-- ... repeat for all 10 tables
```

## Cloud Scheduler Configuration

The deployment script can automatically set up Cloud Scheduler:

- **Schedule:** Daily at 2 AM EST (7 AM UTC)
- **Job Name:** `event-update-daily`
- **Runs After:** `daily-update-job` (1 AM EST)
- **Timeout:** 1 hour
- **Memory:** 4GB
- **CPU:** 2 vCPUs

## Monitoring

### View Logs
```bash
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=event-update-job' \
  --limit=50 \
  --format=json
```

### Check Job Status
```bash
gcloud run jobs describe event-update-job --region=us-central1
```

### View Execution History
```bash
gcloud run jobs executions list \
  --job=event-update-job \
  --region=us-central1 \
  --limit=10
```

## Troubleshooting

### Job Times Out
- Increase `--task-timeout` in deployment script
- Check database connection (might be slow)
- Verify minute data exists for target date

### No Events Inserted
- Check if minute data exists: `SELECT COUNT(*) FROM minute_stock WHERE et_date = '2025-10-24'`
- Check if baselines exist: `SELECT COUNT(*) FROM baseline_daily WHERE trading_day = '2025-10-23'`
- Verify trading_calendar has correct prev_open_date

### Duplicate Events
- The system uses ON CONFLICT DO NOTHING
- Safe to re-run for same date
- Will skip existing events

### Missing Data for Specific Symbol
- Check if minute data was fetched: `SELECT COUNT(*) FROM minute_stock WHERE symbol = 'HIVE' AND et_date = '2025-10-24'`
- Check if baseline was calculated: `SELECT * FROM baseline_daily WHERE symbol = 'HIVE' AND trading_day = '2025-10-23'`

## Performance Expectations

### Single Day Processing
- **Per Group:** ~1-2 seconds (900 combinations)
- **Total Groups:** 110 (11 symbols × 5 methods × 2 sessions)
- **Total Time:** ~2-3 minutes

### Backfill (3 Days)
- **Expected:** ~6-9 minutes total
- **Events Generated:** ~300,000-500,000 per day
- **Total Events:** ~1-1.5 million for 3 days

## Database Schema

Each specialized table has the same structure:

```sql
CREATE TABLE trade_events_rth_equal_mean (
  symbol VARCHAR(10) NOT NULL,
  buy_pct NUMERIC(4,1) NOT NULL,
  sell_pct NUMERIC(4,1) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  event_type VARCHAR(4) NOT NULL,  -- 'BUY' or 'SELL'
  stock_price NUMERIC(10,4) NOT NULL,
  btc_price NUMERIC(10,2) NOT NULL,
  ratio NUMERIC(10,4) NOT NULL,
  baseline NUMERIC(10,4) NOT NULL,
  trade_roi_pct NUMERIC(10,2),     -- Only for SELL events
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (symbol, buy_pct, sell_pct, event_date, event_time)
);
```

## Cost Estimates

### Cloud Run Jobs
- **Execution Time:** ~3 minutes/day
- **Memory:** 4GB
- **CPU:** 2 vCPUs
- **Cost:** ~$0.10-0.20 per day
- **Monthly:** ~$3-6

### Cloud Scheduler
- **Cost:** $0.10 per job per month
- **Total:** $0.10/month

### Total Monthly Cost
- **Event Update System:** ~$3-7/month
- **Combined with Daily Update:** ~$6-12/month

## Integration with Reports

All dashboard reports depend on these tables:
- **Fast Daily** - Queries specific table based on method+session
- **Best Performers** - Queries all 10 tables in parallel
- **Daily Curve** - Queries specific tables for selected symbols
- **Custom Pattern Analyzer** - Queries tables for pattern dates

## Maintenance

### Weekly
- Check Cloud Scheduler is running
- Verify no failed executions
- Monitor event counts

### Monthly
- Review logs for errors
- Check database size growth
- Verify data completeness

### As Needed
- Backfill missing dates
- Adjust memory/CPU if needed
- Update baseline methods if changed

## Future Enhancements

### Potential Improvements
1. **Parallel Processing** - Process multiple symbols simultaneously
2. **Caching** - Cache minute data for faster re-runs
3. **Incremental Baselines** - Only recalculate changed baselines
4. **Compression** - Archive old events to reduce table size
5. **Alerts** - Send notifications on failures

### Scalability
Current system handles:
- 11 symbols
- 5 methods
- 2 sessions
- 900 combinations
- = 99,000 simulations/day

Can scale to:
- More symbols (add to SYMBOLS array)
- More methods (add to METHODS array)
- More combinations (adjust buy/sell ranges)
- Longer timeframes (process multiple days)

## Support

For issues or questions:
1. Check logs first
2. Verify data exists in source tables
3. Test with single date manually
4. Review error messages in Cloud Logging
5. Check database connectivity

## Summary

The Event Update System is a critical component that keeps all reports working with fresh data. It processes daily trading data incrementally, handles wallet continuity correctly, and populates 10 specialized tables efficiently. With proper deployment and monitoring, it runs automatically every night and requires minimal maintenance.