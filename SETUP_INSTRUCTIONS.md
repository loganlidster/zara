# 🎯 DATABASE SETUP - COPY THIS SQL INTO CLOUD SQL EDITOR

## STEP 1: Open Cloud SQL Editor
1. Go to Google Cloud Console
2. Click **SQL** in left sidebar
3. Click your database instance
4. Click **"QUERY"** or **"SQL"** tab at the top

## STEP 2: Copy ALL of this SQL and paste it into the editor

```sql
-- ============================================
-- TRADIAC PRE-COMPUTATION TABLES
-- ============================================

-- Table 1: Pre-computed Trades
CREATE TABLE IF NOT EXISTS precomputed_trades (
    id SERIAL PRIMARY KEY,
    
    -- Simulation Parameters
    symbol VARCHAR(10) NOT NULL,
    baseline_method VARCHAR(20) NOT NULL,
    buy_threshold_pct NUMERIC(5,2) NOT NULL,
    sell_threshold_pct NUMERIC(5,2) NOT NULL,
    
    -- Trade Details
    entry_date DATE NOT NULL,
    entry_time TIME NOT NULL,
    entry_session VARCHAR(3) NOT NULL,
    entry_price NUMERIC(10,2) NOT NULL,
    entry_baseline NUMERIC(10,2) NOT NULL,
    
    exit_date DATE NOT NULL,
    exit_time TIME NOT NULL,
    exit_session VARCHAR(3) NOT NULL,
    exit_price NUMERIC(10,2) NOT NULL,
    exit_baseline NUMERIC(10,2) NOT NULL,
    
    -- Performance Metrics
    position_type VARCHAR(5) NOT NULL,
    shares INTEGER NOT NULL,
    trade_return_pct NUMERIC(10,4) NOT NULL,
    trade_return_dollars NUMERIC(12,2) NOT NULL,
    
    -- Delta Analysis
    stock_delta_pct NUMERIC(10,4),
    btc_delta_pct NUMERIC(10,4),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_trade UNIQUE (symbol, baseline_method, buy_threshold_pct, sell_threshold_pct, entry_date, entry_time)
);

CREATE INDEX IF NOT EXISTS idx_precomputed_symbol ON precomputed_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_precomputed_method ON precomputed_trades(baseline_method);
CREATE INDEX IF NOT EXISTS idx_precomputed_params ON precomputed_trades(symbol, baseline_method, buy_threshold_pct, sell_threshold_pct);
CREATE INDEX IF NOT EXISTS idx_precomputed_dates ON precomputed_trades(entry_date, exit_date);
CREATE INDEX IF NOT EXISTS idx_precomputed_combo_date ON precomputed_trades(symbol, baseline_method, buy_threshold_pct, sell_threshold_pct, entry_date);

-- Table 2: Simulation State
CREATE TABLE IF NOT EXISTS simulation_state (
    id SERIAL PRIMARY KEY,
    
    -- Simulation Parameters
    symbol VARCHAR(10) NOT NULL,
    baseline_method VARCHAR(20) NOT NULL,
    buy_threshold_pct NUMERIC(5,2) NOT NULL,
    sell_threshold_pct NUMERIC(5,2) NOT NULL,
    
    -- Current Position State
    has_position BOOLEAN NOT NULL DEFAULT FALSE,
    position_type VARCHAR(5),
    
    entry_date DATE,
    entry_time TIME,
    entry_session VARCHAR(3),
    entry_price NUMERIC(10,2),
    entry_baseline NUMERIC(10,2),
    shares INTEGER,
    
    -- Processing State
    last_processed_date DATE NOT NULL,
    last_processed_time TIME NOT NULL,
    
    -- Metadata
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_simulation_state UNIQUE (symbol, baseline_method, buy_threshold_pct, sell_threshold_pct)
);

CREATE INDEX IF NOT EXISTS idx_state_combo ON simulation_state(symbol, baseline_method, buy_threshold_pct, sell_threshold_pct);
CREATE INDEX IF NOT EXISTS idx_state_last_processed ON simulation_state(last_processed_date);

-- Table 3: Processing Log
CREATE TABLE IF NOT EXISTS processing_log (
    id SERIAL PRIMARY KEY,
    
    run_date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    
    combinations_processed INTEGER,
    trades_created INTEGER,
    states_updated INTEGER,
    
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processing_log_date ON processing_log(run_date);

-- Verification
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('precomputed_trades', 'simulation_state', 'processing_log')
ORDER BY table_name;
```

## STEP 3: Click "RUN" button

## STEP 4: Verify Success
You should see at the bottom:
- 3 tables created
- 9 indexes created
- Verification query showing 3 tables with column counts

## STEP 5: Tell me "Tables created" and I'll start building the processor immediately!