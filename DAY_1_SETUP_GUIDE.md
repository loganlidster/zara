# 🔥 DAY 1: FOUNDATION & DATA PIPELINE

## MISSION: Get data flowing from Polygon.io into PostgreSQL with baseline calculations

---

## STEP 1: Google Cloud Project Setup (15 minutes)

### 1.1 Create Project
```bash
# Set project name
export PROJECT_ID="tradiac-testing-platform"
export REGION="us-central1"

# Create project
gcloud projects create $PROJECT_ID --name="TRADIAC Testing Platform"

# Set as active project
gcloud config set project $PROJECT_ID

# Enable billing (REQUIRED - do this in console)
# Go to: https://console.cloud.google.com/billing
```

### 1.2 Enable Required APIs
```bash
# Enable all necessary APIs
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable bigquery.googleapis.com
```

---

## STEP 2: PostgreSQL Database Setup (20 minutes)

### 2.1 Create Cloud SQL Instance
```bash
# Create PostgreSQL instance (db-f1-micro for dev, db-n1-standard-2+ for production)
gcloud sql instances create tradiac-testing-db \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=100GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4

# Set root password
gcloud sql users set-password postgres \
  --instance=tradiac-testing-db \
  --password="YOUR_SECURE_PASSWORD_HERE"

# Get connection name
gcloud sql instances describe tradiac-testing-db --format="value(connectionName)"
# Save this! Format: project:region:instance
```

### 2.2 Create Database
```bash
# Create the database
gcloud sql databases create tradiac_testing --instance=tradiac-testing-db
```

### 2.3 Allow Cloud Shell Access
```bash
# Get your Cloud Shell IP (changes each session)
curl -s https://api.ipify.org

# Add to authorized networks (replace with your IP)
gcloud sql instances patch tradiac-testing-db \
  --authorized-networks=YOUR_CLOUD_SHELL_IP/32
```

---

## STEP 3: Store Secrets (10 minutes)

### 3.1 Store Polygon API Key
```bash
# Store Polygon.io API key in Secret Manager
echo -n "YOUR_POLYGON_API_KEY" | gcloud secrets create polygon-api-key --data-file=-

# Grant access to Cloud Functions
gcloud secrets add-iam-policy-binding polygon-api-key \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3.2 Store Database Password
```bash
# Store database password
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# Grant access
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## STEP 4: GitHub Repository Setup (10 minutes)

### 4.1 Create Repository
```bash
# In GitHub web interface:
# 1. Go to https://github.com/new
# 2. Name: tradiac-testing-platform
# 3. Private repository
# 4. Initialize with README
# 5. Create repository

# Clone to Cloud Shell
cd ~
git clone https://github.com/YOUR_USERNAME/tradiac-testing-platform.git
cd tradiac-testing-platform
```

### 4.2 Create .gitignore
```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.*.local

# Secrets
secrets/
*.key
*.pem

# Build outputs
dist/
build/
.next/

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Cloud
.gcloud/
.firebase/

# Testing
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
*.tmp
EOF

git add .gitignore
git commit -m "Add .gitignore"
git push
```

---

## STEP 5: Database Schema Creation (30 minutes)

### 5.1 Create Schema File

Create `database/schema/01_create_tables.sql`:

```sql
-- ============================================
-- TRADIAC TESTING PLATFORM - DATABASE SCHEMA
-- ============================================

-- Drop existing tables (careful in production!)
DROP TABLE IF EXISTS simulation_trades CASCADE;
DROP TABLE IF EXISTS simulation_performance CASCADE;
DROP TABLE IF EXISTS simulation_runs CASCADE;
DROP TABLE IF EXISTS baseline_daily CASCADE;
DROP TABLE IF EXISTS minute_btc CASCADE;
DROP TABLE IF EXISTS minute_stock CASCADE;

-- ============================================
-- RAW MINUTE DATA TABLES
-- ============================================

-- Stock minute data (9 mining stocks)
CREATE TABLE minute_stock (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
    et_date DATE NOT NULL,
    et_time TIME NOT NULL,
    open NUMERIC(10,4) NOT NULL,
    high NUMERIC(10,4) NOT NULL,
    low NUMERIC(10,4) NOT NULL,
    close NUMERIC(10,4) NOT NULL,
    volume BIGINT NOT NULL,
    vwap NUMERIC(10,4),
    trades INTEGER,
    session VARCHAR(10) NOT NULL, -- 'RTH' or 'AH'
    source VARCHAR(20) DEFAULT 'polygon',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_stock_minute UNIQUE (symbol, bar_time)
);

-- Bitcoin minute data
CREATE TABLE minute_btc (
    id BIGSERIAL PRIMARY KEY,
    bar_time TIMESTAMPTZ NOT NULL,
    et_date DATE NOT NULL,
    et_time TIME NOT NULL,
    open NUMERIC(12,2) NOT NULL,
    high NUMERIC(12,2) NOT NULL,
    low NUMERIC(12,2) NOT NULL,
    close NUMERIC(12,2) NOT NULL,
    volume BIGINT NOT NULL,
    vwap NUMERIC(12,2),
    trades INTEGER,
    session VARCHAR(10) NOT NULL, -- 'RTH' or 'AH'
    source VARCHAR(20) DEFAULT 'polygon',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_btc_minute UNIQUE (bar_time)
);

-- ============================================
-- BASELINE CALCULATIONS
-- ============================================

CREATE TABLE baseline_daily (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    session VARCHAR(10) NOT NULL, -- 'RTH' or 'AH'
    trading_day DATE NOT NULL,
    method VARCHAR(50) NOT NULL, -- 'VWAP_RATIO', 'VOL_WEIGHTED', etc.
    baseline NUMERIC(18,6) NOT NULL,
    sample_count INTEGER,
    min_ratio NUMERIC(18,6),
    max_ratio NUMERIC(18,6),
    std_dev NUMERIC(18,6),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_baseline UNIQUE (symbol, session, trading_day, method)
);

-- ============================================
-- SIMULATION TABLES
-- ============================================

-- Simulation run metadata
CREATE TABLE simulation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) DEFAULT 'default',
    symbol VARCHAR(10) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    baseline_method VARCHAR(50) NOT NULL,
    buy_threshold NUMERIC(6,3) NOT NULL, -- e.g., 1.5 for 1.5%
    sell_threshold NUMERIC(6,3) NOT NULL,
    session VARCHAR(10) NOT NULL, -- 'RTH', 'AH', or 'BOTH'
    initial_capital NUMERIC(12,2) DEFAULT 10000.00,
    
    -- Results summary
    total_return NUMERIC(10,4),
    total_return_pct NUMERIC(10,4),
    sharpe_ratio NUMERIC(10,4),
    max_drawdown NUMERIC(10,4),
    max_drawdown_pct NUMERIC(10,4),
    win_rate NUMERIC(6,3),
    total_trades INTEGER,
    winning_trades INTEGER,
    losing_trades INTEGER,
    avg_trade_return NUMERIC(10,4),
    avg_win NUMERIC(10,4),
    avg_loss NUMERIC(10,4),
    best_trade NUMERIC(10,4),
    worst_trade NUMERIC(10,4),
    final_portfolio_value NUMERIC(12,2),
    
    -- Execution metadata
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_thresholds CHECK (buy_threshold > 0 AND sell_threshold > 0)
);

-- Individual simulated trades
CREATE TABLE simulation_trades (
    trade_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES simulation_runs(run_id) ON DELETE CASCADE,
    trade_date DATE NOT NULL,
    trade_time TIME NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
    
    -- Trade details
    action VARCHAR(10) NOT NULL, -- 'BUY' or 'SELL'
    shares INTEGER NOT NULL,
    price NUMERIC(10,4) NOT NULL, -- Execution price (rounded conservatively)
    
    -- Market context
    btc_price NUMERIC(12,2) NOT NULL,
    stock_price NUMERIC(10,4) NOT NULL,
    current_ratio NUMERIC(18,6) NOT NULL,
    baseline NUMERIC(18,6) NOT NULL,
    deviation_pct NUMERIC(10,4) NOT NULL,
    
    -- Position tracking
    position_before INTEGER NOT NULL, -- Shares before trade
    position_after INTEGER NOT NULL, -- Shares after trade
    cash_before NUMERIC(12,2) NOT NULL,
    cash_after NUMERIC(12,2) NOT NULL,
    portfolio_value NUMERIC(12,2) NOT NULL,
    
    -- Trade outcome (for sells)
    trade_return NUMERIC(10,4), -- $ return for this trade
    trade_return_pct NUMERIC(10,4), -- % return for this trade
    
    CONSTRAINT chk_action CHECK (action IN ('BUY', 'SELL')),
    CONSTRAINT chk_shares CHECK (shares > 0)
);

-- Daily performance snapshots
CREATE TABLE simulation_performance (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES simulation_runs(run_id) ON DELETE CASCADE,
    trading_day DATE NOT NULL,
    
    -- Daily metrics
    day_start_value NUMERIC(12,2) NOT NULL,
    day_end_value NUMERIC(12,2) NOT NULL,
    day_return NUMERIC(10,4) NOT NULL,
    day_return_pct NUMERIC(10,4) NOT NULL,
    
    -- Position tracking
    shares_held INTEGER NOT NULL,
    cash_balance NUMERIC(12,2) NOT NULL,
    
    -- Trade activity
    trades_today INTEGER DEFAULT 0,
    buys_today INTEGER DEFAULT 0,
    sells_today INTEGER DEFAULT 0,
    
    -- Running metrics
    cumulative_return NUMERIC(10,4) NOT NULL,
    cumulative_return_pct NUMERIC(10,4) NOT NULL,
    peak_value NUMERIC(12,2) NOT NULL,
    drawdown NUMERIC(10,4) NOT NULL,
    drawdown_pct NUMERIC(10,4) NOT NULL,
    
    CONSTRAINT uq_run_day UNIQUE (run_id, trading_day)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE minute_stock IS 'Minute-level price data for 9 Bitcoin mining stocks';
COMMENT ON TABLE minute_btc IS 'Minute-level price data for Bitcoin (X:BTCUSD)';
COMMENT ON TABLE baseline_daily IS 'Pre-calculated daily baselines using 5 different methods';
COMMENT ON TABLE simulation_runs IS 'Metadata and summary results for each simulation run';
COMMENT ON TABLE simulation_trades IS 'Individual trades executed during simulations';
COMMENT ON TABLE simulation_performance IS 'Daily performance snapshots for each simulation';

COMMENT ON COLUMN minute_stock.session IS 'RTH = Regular Trading Hours (9:30-16:00 ET), AH = After Hours';
COMMENT ON COLUMN baseline_daily.method IS 'VWAP_RATIO, VOL_WEIGHTED, WINSORIZED, WEIGHTED_MEDIAN, or EQUAL_MEAN';
COMMENT ON COLUMN simulation_trades.price IS 'Conservative execution price: rounded UP for buys, DOWN for sells';
```

### 5.2 Deploy Schema
```bash
# Connect to database and run schema
gcloud sql connect tradiac-testing-db --user=postgres --database=tradiac_testing

# Paste the SQL from above, or:
# \i /path/to/01_create_tables.sql

# Verify tables created
\dt

# Exit
\q
```

---

## STEP 6: Create Indexes (15 minutes)

Create `database/schema/02_create_indexes.sql`:

```sql
-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Minute stock indexes
CREATE INDEX idx_stock_symbol_time ON minute_stock(symbol, bar_time);
CREATE INDEX idx_stock_date ON minute_stock(et_date);
CREATE INDEX idx_stock_session ON minute_stock(session);
CREATE INDEX idx_stock_symbol_date ON minute_stock(symbol, et_date);

-- Minute BTC indexes
CREATE INDEX idx_btc_time ON minute_btc(bar_time);
CREATE INDEX idx_btc_date ON minute_btc(et_date);
CREATE INDEX idx_btc_session ON minute_btc(session);

-- Baseline indexes
CREATE INDEX idx_baseline_symbol_day ON baseline_daily(symbol, trading_day);
CREATE INDEX idx_baseline_method ON baseline_daily(method);
CREATE INDEX idx_baseline_symbol_session ON baseline_daily(symbol, session, trading_day);

-- Simulation run indexes
CREATE INDEX idx_run_symbol ON simulation_runs(symbol);
CREATE INDEX idx_run_dates ON simulation_runs(start_date, end_date);
CREATE INDEX idx_run_method ON simulation_runs(baseline_method);
CREATE INDEX idx_run_created ON simulation_runs(created_at);

-- Simulation trade indexes
CREATE INDEX idx_trade_run ON simulation_trades(run_id);
CREATE INDEX idx_trade_date ON simulation_trades(trade_date);
CREATE INDEX idx_trade_action ON simulation_trades(action);

-- Simulation performance indexes
CREATE INDEX idx_perf_run ON simulation_performance(run_id);
CREATE INDEX idx_perf_day ON simulation_performance(trading_day);

-- Analyze tables for query optimization
ANALYZE minute_stock;
ANALYZE minute_btc;
ANALYZE baseline_daily;
ANALYZE simulation_runs;
ANALYZE simulation_trades;
ANALYZE simulation_performance;
```

Deploy indexes:
```bash
gcloud sql connect tradiac-testing-db --user=postgres --database=tradiac_testing
# Paste SQL above
\q
```

---

## STEP 7: Project Structure Setup (10 minutes)

```bash
cd ~/tradiac-testing-platform

# Create directory structure
mkdir -p database/schema database/migrations
mkdir -p data-pipeline/src/{fetchers,processors,storage,config}
mkdir -p simulation-engine/src/{core,metrics,optimizers,config}
mkdir -p cloud-functions/functions/{runSimulation,runGridSearch,getOptimalSettings,getHistoricalData}
mkdir -p cloud-functions/shared
mkdir -p frontend/src/{components,pages,services,utils}
mkdir -p frontend/public
mkdir -p scripts
mkdir -p docs
mkdir -p tests/{unit,integration,e2e}

# Create placeholder README files
echo "# Database Schema" > database/README.md
echo "# Data Pipeline" > data-pipeline/README.md
echo "# Simulation Engine" > simulation-engine/README.md
echo "# Cloud Functions" > cloud-functions/README.md
echo "# Frontend" > frontend/README.md

# Commit structure
git add .
git commit -m "Create project structure"
git push
```

---

## STEP 8: Data Pipeline - Polygon Fetcher (45 minutes)

### 8.1 Initialize Data Pipeline Package
```bash
cd ~/tradiac-testing-platform/data-pipeline

# Create package.json
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

npm install
```

### 8.2 Create Config File
```bash
cat > src/config/config.js << 'EOF'
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  polygon: {
    apiKey: process.env.POLYGON_API_KEY,
    baseUrl: 'https://api.polygon.io'
  },
  database: {
    host: process.env.DB_HOST || '/cloudsql/YOUR_CONNECTION_NAME',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tradiac_testing',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  },
  symbols: [
    'RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 
    'CORZ', 'CIFR', 'CAN', 'HIVE'
  ],
  btcSymbol: 'X:BTCUSD'
};
EOF
```

### 8.3 Create .env File
```bash
cat > .env << 'EOF'
POLYGON_API_KEY=your_polygon_api_key_here
DB_HOST=/cloudsql/your-project:region:instance
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=your_db_password_here
EOF

# Add to .gitignore (already done)
```

---

## CHECKPOINT: What We've Accomplished ✅

- [x] Google Cloud project created
- [x] PostgreSQL database running
- [x] Database schema deployed
- [x] Performance indexes created
- [x] GitHub repository set up
- [x] Project structure created
- [x] Data pipeline initialized

## NEXT: Continue with Polygon Fetcher Implementation

Ready to continue? Say "continue" and I'll provide the Polygon fetcher code!