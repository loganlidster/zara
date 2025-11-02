# Crypto Event Generation - Cloud Run Deployment

## Current Status
- ✅ Crypto data imported: 16 symbols, 18 months (May 2024 - Nov 2025)
- 🔄 Baselines calculating: ~15-20% complete (will finish in ~30-60 minutes)
- ⏳ Events: Ready to deploy once baselines complete

## What This Does
Generates trading events for 16 cryptocurrencies using 2 baseline methods:
- EQUAL_MEAN (simple average)
- WINSORIZED (outlier-resistant average)

Each job processes:
- 16 crypto symbols
- 540 days of data
- 900 buy/sell combinations (0.1% to 3.0%)
- Expected: ~50-100M events total

## Prerequisites
1. Wait for baselines to complete (check with: `tail -f processor/crypto-baseline.log`)
2. Verify baselines exist:
   ```sql
   SELECT COUNT(*) FROM baseline_daily_crypto;
   -- Should show ~17,280 baselines (16 symbols × 540 days × 2 methods)
   ```

## Deployment Steps

### 1. Upload Files to Cloud Shell
Upload these files to your Cloud Shell:
- `Dockerfile`
- `package.json`
- `crypto-event-generation.js`
- `deploy.sh`

### 2. Run Deployment
```bash
cd ~/cloudshell_crypto
chmod +x deploy.sh
./deploy.sh
```

This will:
1. Build Docker image (~2 minutes)
2. Deploy 2 Cloud Run jobs
3. Start both jobs immediately

### 3. Monitor Progress
Watch the jobs at:
https://console.cloud.google.com/run/jobs?project=tradiac-testing

Or use CLI:
```bash
# Check job status
gcloud run jobs describe crypto-event-equal-mean --region us-central1
gcloud run jobs describe crypto-event-winsorized --region us-central1

# View logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=crypto-event-equal-mean" --limit 50 --format json
```

## Expected Timeline
- Build: 2 minutes
- Each job: 30-60 minutes
- Total: ~1-2 hours for both jobs

## Cost Estimate
- 2 jobs × 1 hour × 4 CPU × 8GB RAM
- Estimated: $3-5 total

## Verification After Completion
```sql
-- Check event counts
SELECT 
  'trade_events_crypto_equal_mean' as table_name,
  COUNT(*) as events
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'trade_events_crypto_winsorized',
  COUNT(*)
FROM trade_events_crypto_winsorized;
```

Expected: 25-50M events per table

## Troubleshooting

### Job fails with "out of memory"
Increase memory:
```bash
gcloud run jobs update crypto-event-equal-mean --memory 16Gi --region us-central1
```

### Job times out
Increase timeout:
```bash
gcloud run jobs update crypto-event-equal-mean --task-timeout 6h --region us-central1
```

### Need to rerun a job
```bash
gcloud run jobs execute crypto-event-equal-mean --region us-central1
```

## After Events Complete
1. Update API endpoints to include crypto data
2. Create crypto reports in frontend
3. Test with sample queries