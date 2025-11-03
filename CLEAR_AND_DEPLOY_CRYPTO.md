# Clear Crypto Event Tables and Deploy New Generation

## Current State
- **trade_events_crypto_equal_mean**: 13.5M events (old 0.1% increments)
- **trade_events_crypto_winsorized**: 13.3M events (old 0.1% increments)

## New Configuration
- **Thresholds**: 0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0
- **Combinations**: 169 (13×13)
- **Date Range**: Oct 1, 2024 - Nov 2, 2025 (13 months)
- **Symbols**: 19 cryptos (ADA, AVAX, BCH, CUSD, DOGE, ETH, HBAR, HYPE, LEO, LINK, LTC, SOL, SUI, TON, TRX, TUSD, XLM, XMR, XRP)
- **Fee Optimization**: Minimum 0.2% net profit after 0.3% round-trip fees

---

## STEP 1: Clear Old Event Data

Paste this in Cloud Shell:

```bash
# Connect to database and clear tables
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
SELECT 'Tables cleared successfully' as status;
EOF
```

---

## STEP 2: Deploy Event Generation to Cloud Run

Paste this in Cloud Shell:

```bash
cd ~/zara/cloudshell_crypto

# Build and deploy the Docker image
gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator

# Deploy as Cloud Run Job
gcloud run jobs deploy crypto-event-job \
  --image gcr.io/tradiac-testing/crypto-event-generator \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --max-retries 0 \
  --task-timeout 3h \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

echo "Deployment complete!"
```

---

## STEP 3: Execute Both Jobs in Parallel

Paste this in Cloud Shell:

```bash
# Execute EQUAL_MEAN job
gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --set-env-vars METHOD=EQUAL_MEAN \
  --async

# Execute WINSORIZED job
gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --set-env-vars METHOD=WINSORIZED \
  --async

echo "Both jobs started!"
echo "Monitor progress at: https://console.cloud.google.com/run/jobs?project=tradiac-testing"
```

---

## Expected Results

### Event Counts (Estimated)
- **Per symbol**: ~450K events (169 combos × ~2,700 events per combo)
- **EQUAL_MEAN**: ~8.5M events (19 symbols)
- **WINSORIZED**: ~8.5M events (19 symbols)
- **Total**: ~17M events

### Processing Time
- **Per job**: 15-20 minutes
- **Total time**: 15-20 minutes (parallel execution)

### Cost
- **Per job**: ~$1.50
- **Total**: ~$3.00

---

## Verification Commands

After jobs complete, paste this in Cloud Shell:

```bash
# Check event counts
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
SELECT 
  'trade_events_crypto_equal_mean' as table_name,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  MIN(event_timestamp::date) as earliest_date,
  MAX(event_timestamp::date) as latest_date
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'trade_events_crypto_winsorized' as table_name,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  MIN(event_timestamp::date) as earliest_date,
  MAX(event_timestamp::date) as latest_date
FROM trade_events_crypto_winsorized;
EOF
```

---

## Summary

**Copy and paste these 3 code blocks in order:**
1. Clear tables
2. Deploy to Cloud Run
3. Execute both jobs

**Total time**: ~20 minutes  
**Total cost**: ~$3