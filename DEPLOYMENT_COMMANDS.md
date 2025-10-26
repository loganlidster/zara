# 🚀 DEPLOYMENT COMMANDS - COPY & PASTE READY

## STEP-BY-STEP DEPLOYMENT GUIDE

### PHASE 1: Google Cloud Setup (5 minutes)

```bash
# 1. Set your project ID (CHANGE THIS!)
export PROJECT_ID="tradiac-testing-platform"
export REGION="us-central1"

# 2. Create and set project
gcloud projects create $PROJECT_ID --name="TRADIAC Testing Platform"
gcloud config set project $PROJECT_ID

# 3. Enable billing (MUST DO IN CONSOLE)
echo "⚠️  IMPORTANT: Enable billing at https://console.cloud.google.com/billing"
echo "Press ENTER after enabling billing..."
read

# 4. Enable APIs
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### PHASE 2: PostgreSQL Database (10 minutes)

```bash
# 1. Create Cloud SQL instance
gcloud sql instances create tradiac-testing-db \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=100GB \
  --storage-auto-increase \
  --backup-start-time=03:00

# 2. Set password (CHANGE THIS!)
export DB_PASSWORD="YourSecurePassword123!"
gcloud sql users set-password postgres \
  --instance=tradiac-testing-db \
  --password="$DB_PASSWORD"

# 3. Get connection name
export CONNECTION_NAME=$(gcloud sql instances describe tradiac-testing-db --format="value(connectionName)")
echo "Connection name: $CONNECTION_NAME"

# 4. Create database
gcloud sql databases create tradiac_testing --instance=tradiac-testing-db

# 5. Allow Cloud Shell access
export MY_IP=$(curl -s https://api.ipify.org)
gcloud sql instances patch tradiac-testing-db \
  --authorized-networks=$MY_IP/32
```

### PHASE 3: Store Secrets (5 minutes)

```bash
# 1. Store Polygon API key (CHANGE THIS!)
export POLYGON_API_KEY="your_polygon_api_key_here"
echo -n "$POLYGON_API_KEY" | gcloud secrets create polygon-api-key --data-file=-

# 2. Store database password
echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# 3. Grant access to default service account
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding polygon-api-key \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### PHASE 4: Deploy Database Schema (5 minutes)

```bash
# 1. Connect to database
gcloud sql connect tradiac-testing-db --user=postgres --database=tradiac_testing

# 2. Copy and paste the ENTIRE schema from COMPLETE_IMPLEMENTATION_PACKAGE.md
# (The 01_create_tables.sql content)

# 3. Then copy and paste the indexes from 02_create_indexes.sql

# 4. Verify tables created
\dt

# 5. Exit
\q
```

### PHASE 5: Clone GitHub Repo (5 minutes)

```bash
# 1. Go to GitHub and create new repository
# Name: tradiac-testing-platform
# Private: Yes
# Initialize: Yes (with README)

# 2. Clone to Cloud Shell (CHANGE YOUR_USERNAME!)
cd ~
git clone https://github.com/YOUR_USERNAME/tradiac-testing-platform.git
cd tradiac-testing-platform

# 3. Create directory structure
mkdir -p database/schema database/migrations
mkdir -p data-pipeline/src/fetchers
mkdir -p data-pipeline/src/processors
mkdir -p data-pipeline/src/storage
mkdir -p data-pipeline/src/config
mkdir -p scripts docs

# 4. Commit structure
git add .
git commit -m "Initial project structure"
git push
```

### PHASE 6: Copy Code Files (10 minutes)

```bash
cd ~/tradiac-testing-platform/data-pipeline

# 1. Create package.json
cat > package.json << 'EOF'
{
  "name": "tradiac-data-pipeline",
  "version": "1.0.0",
  "description": "Data fetching and processing pipeline",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "fetch": "node src/fetchers/polygon-fetcher.js",
    "baselines": "node src/processors/baseline-calculator.js"
  },
  "dependencies": {
    "pg": "^8.11.3",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "date-fns": "^2.30.0",
    "date-fns-tz": "^2.0.0"
  }
}
EOF

# 2. Install dependencies
npm install

# 3. Create .env file (UPDATE VALUES!)
cat > .env << EOF
POLYGON_API_KEY=$POLYGON_API_KEY
DB_HOST=/cloudsql/$CONNECTION_NAME
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
EOF

# 4. Now use Cloud Shell Editor to copy the code files:
# - Open Cloud Shell Editor (click the pencil icon)
# - Navigate to data-pipeline/src/
# - Create each file and paste the code from COMPLETE_IMPLEMENTATION_PACKAGE.md:
#   * config/config.js
#   * fetchers/polygon-fetcher.js
#   * storage/postgres-writer.js
#   * processors/baseline-calculator.js
#   * index.js

echo "✅ Use Cloud Shell Editor to copy the 5 code files now!"
echo "Files to create:"
echo "  1. src/config/config.js"
echo "  2. src/fetchers/polygon-fetcher.js"
echo "  3. src/storage/postgres-writer.js"
echo "  4. src/processors/baseline-calculator.js"
echo "  5. src/index.js"
```

### PHASE 7: Test Connection (2 minutes)

```bash
cd ~/tradiac-testing-platform/data-pipeline

# Test database connection
node -e "
import { getPool, getDataRange } from './src/storage/postgres-writer.js';
const pool = getPool();
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err);
  } else {
    console.log('✅ Connected to database!');
    console.log('Current time:', res.rows[0].now);
  }
  pool.end();
});
"
```

### PHASE 8: Run Data Pipeline (60-90 minutes)

```bash
cd ~/tradiac-testing-platform/data-pipeline

# Option 1: Fetch last 30 days (quick test - 5 minutes)
npm start 2024-01-01 2024-01-31

# Option 2: Fetch 1 year (30 minutes)
npm start 2023-01-01 2023-12-31

# Option 3: Fetch 3 years (90 minutes)
npm start 2021-01-01 2024-01-01

# Monitor progress - you'll see:
# - Fetching data from Polygon.io
# - Inserting into PostgreSQL
# - Calculating baselines
# - Progress percentages

# The pipeline will:
# 1. Fetch BTC + 9 stocks minute data
# 2. Insert into database (with deduplication)
# 3. Calculate all 5 baseline methods
# 4. Store baselines for RTH and AH sessions
```

### PHASE 9: Verify Data (2 minutes)

```bash
# Connect to database
gcloud sql connect tradiac-testing-db --user=postgres --database=tradiac_testing

# Check data counts
SELECT 
  'BTC' as type,
  COUNT(*) as total_bars,
  MIN(et_date) as first_date,
  MAX(et_date) as last_date
FROM minute_btc
UNION ALL
SELECT 
  'Stocks' as type,
  COUNT(*) as total_bars,
  MIN(et_date) as first_date,
  MAX(et_date) as last_date
FROM minute_stock;

# Check baselines
SELECT 
  symbol,
  COUNT(*) as baseline_count,
  MIN(trading_day) as first_day,
  MAX(trading_day) as last_day
FROM baseline_daily
GROUP BY symbol
ORDER BY symbol;

# Exit
\q
```

### PHASE 10: Commit to GitHub (2 minutes)

```bash
cd ~/tradiac-testing-platform

# Add all files
git add .

# Commit
git commit -m "Add data pipeline - Day 1 complete"

# Push
git push

echo "✅ DAY 1 FOUNDATION COMPLETE!"
```

---

## 🎯 EXPECTED RESULTS

After running the pipeline for 3 years (2021-2024):

- **BTC bars**: ~1,576,800 (1,440 minutes/day × 365 days × 3 years)
- **Stock bars**: ~14,191,200 (9 stocks × 1,576,800)
- **Baselines**: ~19,710 (9 stocks × 2 sessions × 365 days × 3 years)

Database size: ~5-10 GB

---

## 🚨 TROUBLESHOOTING

### Connection Issues
```bash
# If connection fails, check authorized networks
gcloud sql instances describe tradiac-testing-db --format="value(ipConfiguration.authorizedNetworks)"

# Add your current IP
export MY_IP=$(curl -s https://api.ipify.org)
gcloud sql instances patch tradiac-testing-db --authorized-networks=$MY_IP/32
```

### Rate Limiting
```bash
# If you hit Polygon rate limits, the script will auto-retry
# Free tier: 5 requests/minute
# Paid tier: Much higher limits
# The script includes 12-second delays between requests
```

### Memory Issues
```bash
# If Cloud Shell runs out of memory, fetch in smaller chunks
# Edit src/fetchers/polygon-fetcher.js
# Change: fetchDataInChunks(startDate, endDate, 30)
# To: fetchDataInChunks(startDate, endDate, 7)  // 7-day chunks
```

---

## ✅ CHECKLIST

- [ ] Google Cloud project created
- [ ] Billing enabled
- [ ] APIs enabled
- [ ] PostgreSQL instance created
- [ ] Database schema deployed
- [ ] Secrets stored
- [ ] GitHub repo created
- [ ] Code files copied
- [ ] Dependencies installed
- [ ] Connection tested
- [ ] Data pipeline run
- [ ] Data verified
- [ ] Committed to GitHub

---

## 🎉 NEXT STEPS

Once Day 1 is complete:
1. ✅ You have 3 years of minute data
2. ✅ You have pre-calculated baselines
3. ✅ Database is ready for simulations
4. 🚀 Ready to build the simulation engine (Day 2)!

---

**Ready to start? Copy these commands one section at a time!** 🔥