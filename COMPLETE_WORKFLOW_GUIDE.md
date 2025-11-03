# Complete Crypto Event Generation Workflow Guide

## 🎯 Purpose of This Document
This document explains our complete workflow for generating crypto trading events. Use this to onboard new AI agents or refresh context in future sessions.

---

## 👥 How We Work Together

### Communication Protocol
- **NO GITHUB**: We do NOT use git push/pull workflows
- **Direct File Transfer**: I create files in the sandbox, you copy them to Cloud Shell manually
- **Command Blocks**: I provide complete, ready-to-paste command blocks
- **Trust & Verification**: You verify my work and catch mistakes (like the GitHub assumption)
- **Iterative Refinement**: We adjust based on real results, not assumptions

### Your Role
- Execute commands in Google Cloud Shell
- Monitor job progress in Cloud Console
- Provide feedback on results
- Catch when I make incorrect assumptions

### My Role
- Create complete, tested scripts
- Provide exact command blocks to paste
- Explain what each step does
- Document everything for future reference

---

## 🏗️ System Architecture

### Database: Google Cloud PostgreSQL
- **Host**: 34.41.97.179
- **Port**: 5432
- **Database**: tradiac_testing
- **User**: postgres
- **Password**: Fu3lth3j3t!

### Tables Structure

#### Minute Data Tables
1. **minute_crypto**: Crypto price bars (1-minute intervals, 24/7)
   - Columns: symbol, timestamp, open, high, low, close, volume
   - ~14.5M rows (May 2024 - Nov 2025)

2. **minute_btc_crypto**: BTC price bars for comparison
   - Same structure as minute_crypto
   - Used to calculate BTC/Crypto ratios

#### Baseline Table
3. **baseline_daily_crypto**: Daily baseline calculations
   - Columns: symbol, trading_day, method, baseline_equal_mean, baseline_winsorized
   - Methods: EQUAL_MEAN, WINSORIZED
   - ~20,710 baselines (19 symbols × 540 days × 2 methods)

#### Event Tables (2 total)
4. **trade_events_crypto_equal_mean**: Events using EQUAL_MEAN baseline
5. **trade_events_crypto_winsorized**: Events using WINSORIZED baseline

Event table schema:
```sql
CREATE TABLE trade_events_crypto_equal_mean (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10),
  buy_pct NUMERIC(5,2),
  sell_pct NUMERIC(5,2),
  event_timestamp TIMESTAMP,
  event_type VARCHAR(4),  -- 'BUY' or 'SELL'
  crypto_price NUMERIC(20,8),
  btc_price NUMERIC(20,8),
  ratio NUMERIC(20,8),
  baseline NUMERIC(20,8),
  trade_roi_pct NUMERIC(10,4)
);
```

---

## 💰 Trading Logic

### Core Concept
We trade crypto based on its ratio to BTC, comparing current ratio to historical baseline:
- **Ratio** = BTC_price / Crypto_price
- **Deviation** = (Current_ratio - Baseline) / Baseline × 100%

### Trading Rules
1. **BUY Signal**: When deviation >= buy_threshold (e.g., 1.0%)
   - Crypto is relatively cheap compared to BTC
   - Enter long position in crypto

2. **SELL Signal**: When deviation <= sell_threshold (e.g., 1.0%)
   - Crypto has recovered relative to BTC
   - Exit position and realize profit

3. **State Machine**: BUY → SELL → BUY → SELL (no position stacking)

### Fee Optimization
- **Trading Fees**: 0.15% per trade (limit orders)
- **Round-trip Cost**: 0.3% (buy + sell)
- **Minimum Profitable Spread**: 0.3% gross = 0.0% net (break-even)
- **Target Spreads**: 0.3% to 5.0% for meaningful profit after fees

### Current Configuration (13×13 Grid)
- **Thresholds**: 0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0
- **Combinations**: 169 (13 buy × 13 sell)
- **Date Range**: Oct 1, 2024 - Nov 2, 2025 (13 months)
- **Symbols**: 19 cryptos (SHIB excluded due to numeric overflow)

---

## 🔧 Event Generation Process

### What the Job Does

1. **For each symbol** (19 cryptos):
   - **For each combination** (169 buy/sell pairs):
     - Fetch all minute bars with baselines for date range
     - Calculate ratio and deviation for each bar
     - Apply state machine logic to generate BUY/SELL events
     - Batch insert events (1500 per INSERT for speed)

2. **Output**: ~17M events total
   - EQUAL_MEAN: ~8.5M events
   - WINSORIZED: ~8.5M events

### Processing Time
- **Per symbol**: ~1 minute (169 combinations)
- **Total per job**: ~20 minutes (19 symbols)
- **Both jobs parallel**: ~20 minutes total

### Cost
- **Per job**: ~$1.50 (8 CPU, 32GB RAM, 20 minutes)
- **Total**: ~$3.00 (both jobs)

---

## 📋 Complete Deployment Workflow

### Prerequisites
- Google Cloud Shell access to project `tradiac-testing`
- Database credentials (already configured)
- Directory structure: `~/zara/cloudshell_crypto/`

### Step-by-Step Process

#### STEP 1: Create Updated Script
This creates the event generation script with current configuration (13×13, Oct 2024-Nov 2025, 19 symbols).

**What to paste in Cloud Shell:**
```bash
cd ~/zara/cloudshell_crypto

cat > crypto-event-generation.js << 'ENDOFFILE'
[FULL SCRIPT CONTENT - see crypto-event-generation.js in zip]
ENDOFFILE

echo "✅ Script created with 13x13 combos, Oct 2024-Nov 2025"
```

**What this does:**
- Creates/overwrites `crypto-event-generation.js` in Cloud Shell
- Embeds the 13×13 threshold configuration
- Sets date range to Oct 2024 - Nov 2025
- Configures 19 crypto symbols

#### STEP 2: Clear Old Event Tables
This removes any existing events to start fresh.

**What to paste in Cloud Shell:**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
TRUNCATE TABLE trade_events_crypto_equal_mean;
TRUNCATE TABLE trade_events_crypto_winsorized;
SELECT 'Tables cleared' as status;
EOF
```

**What this does:**
- Connects to PostgreSQL database
- Truncates both event tables (fast delete)
- Confirms completion

#### STEP 3: Build and Deploy to Cloud Run
This builds a Docker image and deploys it as a Cloud Run Job.

**What to paste in Cloud Shell:**
```bash
cd ~/zara/cloudshell_crypto

gcloud builds submit --tag gcr.io/tradiac-testing/crypto-event-generator

gcloud run jobs deploy crypto-event-job \
  --image gcr.io/tradiac-testing/crypto-event-generator \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --max-retries 0 \
  --task-timeout 3h \
  --set-env-vars DB_HOST=34.41.97.179,DB_PORT=5432,DB_NAME=tradiac_testing,DB_USER=postgres,DB_PASSWORD=Fu3lth3j3t!

echo "✅ Deployment complete!"
```

**What this does:**
- Builds Docker image from Dockerfile + crypto-event-generation.js
- Uploads to Google Container Registry
- Creates/updates Cloud Run Job with 8 CPU, 32GB RAM
- Sets database connection environment variables
- Takes ~5 minutes

#### STEP 4: Execute Both Jobs in Parallel
This starts the actual event generation for both baseline methods.

**What to paste in Cloud Shell:**
```bash
gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --update-env-vars METHOD=EQUAL_MEAN \
  --async

gcloud run jobs execute crypto-event-job \
  --region us-central1 \
  --update-env-vars METHOD=WINSORIZED \
  --async

echo "✅ Both jobs started!"
```

**What this does:**
- Starts EQUAL_MEAN job (processes all 19 symbols with EQUAL_MEAN baseline)
- Starts WINSORIZED job (processes all 19 symbols with WINSORIZED baseline)
- Both run in parallel
- `--async` returns immediately (don't wait for completion)
- Takes ~20 minutes to complete

**IMPORTANT**: Use `--update-env-vars` NOT `--set-env-vars` (common mistake!)

---

## 📊 Monitoring Progress

### Cloud Console
Monitor at: https://console.cloud.google.com/run/jobs?project=tradiac-testing

Look for:
- Job status (Running, Succeeded, Failed)
- Execution logs
- Resource usage

### Database Query
Check event counts in real-time:

```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as events,
  COUNT(DISTINCT symbol) as symbols
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'WINSORIZED' as method,
  COUNT(*) as events,
  COUNT(DISTINCT symbol) as symbols
FROM trade_events_crypto_winsorized;
"
```

### Expected Results
- **EQUAL_MEAN**: ~8.5M events, 19 symbols
- **WINSORIZED**: ~8.5M events, 19 symbols
- **Total**: ~17M events

---

## 🗂️ File Structure

### Cloud Shell Directory: ~/zara/cloudshell_crypto/

```
cloudshell_crypto/
├── Dockerfile                      # Docker build configuration
├── package.json                    # Node.js dependencies
├── crypto-event-generation.js      # Main event generation script
├── deploy.sh                       # Optional: automated deployment script
└── .env                           # Optional: local environment variables
```

### Key Files Explained

#### Dockerfile
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install
COPY crypto-event-generation.js .
CMD ["node", "crypto-event-generation.js"]
```

#### package.json
```json
{
  "name": "crypto-event-generator",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  }
}
```

#### crypto-event-generation.js
- 300+ lines of JavaScript
- Handles database connections, data fetching, event generation, batch inserts
- Configured via environment variables (METHOD, START_DATE, END_DATE)
- See full file in attached zip

---

## 🔍 Verification & Testing

### After Jobs Complete

1. **Check Event Counts**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT 
  'EQUAL_MEAN' as method,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  MIN(event_timestamp::date) as earliest,
  MAX(event_timestamp::date) as latest
FROM trade_events_crypto_equal_mean
UNION ALL
SELECT 
  'WINSORIZED' as method,
  COUNT(*) as total_events,
  COUNT(DISTINCT symbol) as symbols,
  MIN(event_timestamp::date) as earliest,
  MAX(event_timestamp::date) as latest
FROM trade_events_crypto_winsorized;
"
```

2. **Verify Date Range**
Should show: Oct 1, 2024 - Nov 2, 2025

3. **Check Sample Events**
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT * FROM trade_events_crypto_equal_mean 
WHERE symbol = 'ETH' AND buy_pct = 1.0 AND sell_pct = 1.0 
ORDER BY event_timestamp 
LIMIT 10;
"
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Jobs Not Starting
**Symptom**: `gcloud run jobs execute` returns error about `--set-env-vars`
**Solution**: Use `--update-env-vars` instead of `--set-env-vars`

### Issue 2: No Events Generated
**Symptom**: Event tables remain empty after job completes
**Causes**:
- No baseline data for date range
- Script has wrong date range
- Database connection failed

**Debug**:
```bash
# Check baseline coverage
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing -c "
SELECT COUNT(*), MIN(trading_day), MAX(trading_day) 
FROM baseline_daily_crypto 
WHERE trading_day >= '2024-10-01' AND trading_day <= '2025-11-02';
"
```

### Issue 3: Job Timeout
**Symptom**: Job fails after 3 hours
**Solution**: 
- Reduce date range
- Reduce number of combinations
- Increase CPU/memory allocation

### Issue 4: Out of Memory
**Symptom**: Job crashes with OOM error
**Solution**: Increase memory allocation in deploy command (currently 32Gi)

---

## 🔄 How to Modify Configuration

### Change Thresholds
Edit the `thresholds` array in crypto-event-generation.js:
```javascript
const thresholds = [0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0];
```

### Change Date Range
Edit START_DATE and END_DATE:
```javascript
const START_DATE = process.env.START_DATE || '2024-10-01';
const END_DATE = process.env.END_DATE || '2025-11-02';
```

### Add/Remove Symbols
Edit CRYPTO_SYMBOLS array:
```javascript
const CRYPTO_SYMBOLS = ['ADA', 'AVAX', 'BCH', ...];
```

### After Changes
1. Re-run STEP 1 (create updated script)
2. Skip STEP 2 if you want to keep existing events
3. Re-run STEP 3 (rebuild Docker image)
4. Re-run STEP 4 (execute jobs)

---

## 📈 Frontend Integration

### API Endpoints (Vercel)
- **Base URL**: https://api-server-neon-five.vercel.app
- **Crypto Grid Search**: `/api/crypto/crypto-grid-search`
- **Crypto Daily Curve**: `/api/crypto/crypto-daily-curve`

### Frontend (Vercel)
- **Base URL**: https://raas.help
- **Crypto Reports**: https://raas.help/crypto
- **Grid Search**: https://raas.help/reports/crypto-grid-search

### How Reports Use Events
1. User selects symbol, date range, buy/sell thresholds
2. API queries event table with filters
3. Calculates aggregate metrics (total trades, win rate, avg ROI)
4. Returns results for visualization

---

## 💡 Key Insights & Lessons Learned

### 1. No GitHub Workflow
- We do NOT use git push/pull
- All files created directly in Cloud Shell via `cat > file` commands
- This avoids sync issues and keeps workflow simple

### 2. Trust But Verify
- Always verify configuration before deploying
- Check thresholds, dates, symbols in the script
- Don't assume - confirm with database queries

### 3. Fee Optimization Matters
- 0.3% round-trip fees mean minimum 0.3% spread needed
- Lower thresholds (0.1%, 0.2%) are unprofitable
- Start at 0.3% for break-even, 0.5%+ for profit

### 4. Batch Inserts Are Critical
- 1500 events per INSERT = 80x faster than individual inserts
- Without batching, jobs would take 40+ hours instead of 20 minutes

### 5. Parallel Execution Saves Time
- Running both methods in parallel = 20 minutes total
- Sequential would be 40 minutes
- Cost is the same either way

---

## 📦 What's in the Zip File

```
crypto-event-generation-package/
├── COMPLETE_WORKFLOW_GUIDE.md          # This document
├── cloudshell_crypto/
│   ├── Dockerfile                      # Docker configuration
│   ├── package.json                    # Node.js dependencies
│   ├── crypto-event-generation.js      # Main script (13×13, Oct 2024-Nov 2025)
│   └── deploy.sh                       # Optional automated deployment
├── deployment_blocks/
│   ├── BLOCK_1_create_script.sh        # Step 1 commands
│   ├── BLOCK_2_clear_tables.sh         # Step 2 commands
│   ├── BLOCK_3_deploy.sh               # Step 3 commands
│   └── BLOCK_4_execute.sh              # Step 4 commands (CORRECTED)
├── verification/
│   ├── check_event_counts.sh           # Verify event generation
│   ├── check_baselines.sh              # Verify baseline coverage
│   └── check_sample_events.sh          # View sample events
└── README.txt                          # Quick start instructions
```

---

## 🎯 Quick Start for New AI Agent

If you're a new AI agent reading this:

1. **Read this entire document** to understand the system
2. **User will provide context** about what they want to do
3. **Ask clarifying questions** if anything is unclear
4. **Provide complete command blocks** ready to paste in Cloud Shell
5. **Never assume GitHub workflow** - we use direct file creation
6. **Verify configuration** before deploying (dates, thresholds, symbols)
7. **Use `--update-env-vars`** not `--set-env-vars` for job execution
8. **Trust but verify** - user will catch mistakes, learn from them

---

## 📞 Support & Troubleshooting

### Database Access
If you need to query the database directly:
```bash
PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing
```

### Cloud Run Console
Monitor jobs: https://console.cloud.google.com/run/jobs?project=tradiac-testing

### Logs
View execution logs in Cloud Console for debugging

---

## 🔐 Security Notes

- Database password is in plaintext in this document (internal use only)
- Cloud Run jobs have database credentials in environment variables
- No external API keys required
- All resources within Google Cloud project `tradiac-testing`

---

## 📊 System Metrics

### Current Data Volume
- **Minute bars**: 14.5M rows
- **Baselines**: 20,710 rows
- **Events**: ~17M rows (after generation)
- **Database size**: ~15 GB

### Processing Capacity
- **Events per second**: ~14,000 (with batch inserts)
- **Symbols per minute**: ~1 symbol
- **Total processing time**: ~20 minutes for full backfill

### Cost Structure
- **Database**: ~$70/month (Google Cloud SQL)
- **Event generation**: ~$3 per full backfill
- **API hosting**: Free (Vercel)
- **Frontend hosting**: Free (Vercel)

---

## 🎓 Understanding the Trading Strategy

### Why BTC/Crypto Ratio?
- Crypto prices are highly correlated with BTC
- When BTC rises, most cryptos rise (but at different rates)
- The ratio captures relative strength/weakness
- Trading the ratio is more stable than trading absolute prices

### Why Baseline Comparison?
- Baseline = historical average ratio
- Deviation from baseline indicates temporary imbalance
- Mean reversion: ratios tend to return to baseline
- Buy when ratio is high (crypto cheap), sell when ratio normalizes

### Two Baseline Methods
1. **EQUAL_MEAN**: Simple average of all ratios in previous 24 hours
2. **WINSORIZED**: Average with outliers capped (more robust to spikes)

### Example Trade
- **Baseline**: 68,000 (BTC/ETH ratio)
- **Current ratio**: 68,680 (1% above baseline)
- **Signal**: BUY ETH (it's relatively cheap)
- **Later ratio**: 68,000 (back to baseline)
- **Signal**: SELL ETH (ratio normalized)
- **Result**: Profit from ETH's relative recovery

---

## 🔮 Future Enhancements

### Potential Improvements
1. Add more baseline methods (VWAP_RATIO, VOL_WEIGHTED, WEIGHTED_MEDIAN)
2. Implement stop-loss logic (exit if ratio moves against us)
3. Add position sizing based on volatility
4. Include transaction costs in ROI calculations
5. Support for multiple timeframes (5-min, 15-min bars)

### Scalability
- Current system handles 19 cryptos × 169 combos = 3,211 strategies
- Could scale to 50+ cryptos with same infrastructure
- Database can handle 100M+ events with proper indexing

---

## ✅ Checklist for Successful Deployment

- [ ] Verified date range is correct (Oct 2024 - Nov 2025)
- [ ] Confirmed 13×13 threshold configuration (169 combos)
- [ ] Checked 19 crypto symbols are correct
- [ ] Cleared old event tables
- [ ] Built and deployed Docker image
- [ ] Started both jobs (EQUAL_MEAN + WINSORIZED)
- [ ] Monitored job progress in Cloud Console
- [ ] Verified event counts match expectations (~17M total)
- [ ] Tested sample queries to confirm data quality
- [ ] Updated frontend if needed

---

**Document Version**: 1.0  
**Last Updated**: November 2, 2025  
**Author**: SuperNinja AI Agent  
**For**: Logan @ TRADIAC Project