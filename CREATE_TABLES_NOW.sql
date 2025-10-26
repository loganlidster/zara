-- TRADIAC Pre-Computed Trades Tables (Dual Session Architecture)
-- Copy and paste this entire file into Cloud SQL Editor

CREATE TABLE IF NOT EXISTS precomputed_trades_rth (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    buy_threshold NUMERIC(10,4) NOT NULL,
    sell_threshold NUMERIC(10,4) NOT NULL,
    allow_shorts BOOLEAN NOT NULL DEFAULT false,
    conservative_pricing BOOLEAN NOT NULL DEFAULT true,
    slippage NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    entry_date DATE NOT NULL,
    entry_time TIME NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,
    entry_baseline NUMERIC(12,4) NOT NULL,
    entry_btc_price NUMERIC(12,4) NOT NULL,
    exit_date DATE NOT NULL,
    exit_time TIME NOT NULL,
    exit_price NUMERIC(12,4) NOT NULL,
    exit_baseline NUMERIC(12,4) NOT NULL,
    exit_btc_price NUMERIC(12,4) NOT NULL,
    position_type VARCHAR(5) NOT NULL CHECK (position_type IN ('LONG', 'SHORT')),
    shares INTEGER NOT NULL,
    trade_return NUMERIC(10,6) NOT NULL,
    stock_delta NUMERIC(10,6),
    btc_delta NUMERIC(10,6),
    session_type VARCHAR(10) NOT NULL DEFAULT 'RTH',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_precomp_rth_symbol ON precomputed_trades_rth(symbol);
CREATE INDEX idx_precomp_rth_method ON precomputed_trades_rth(method);
CREATE INDEX idx_precomp_rth_entry_date ON precomputed_trades_rth(entry_date);
CREATE INDEX idx_precomp_rth_params ON precomputed_trades_rth(symbol, method, buy_threshold, sell_threshold);

CREATE TABLE IF NOT EXISTS precomputed_trades_all (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    buy_threshold NUMERIC(10,4) NOT NULL,
    sell_threshold NUMERIC(10,4) NOT NULL,
    allow_shorts BOOLEAN NOT NULL DEFAULT false,
    conservative_pricing BOOLEAN NOT NULL DEFAULT true,
    slippage NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    entry_date DATE NOT NULL,
    entry_time TIME NOT NULL,
    entry_price NUMERIC(12,4) NOT NULL,
    entry_baseline NUMERIC(12,4) NOT NULL,
    entry_btc_price NUMERIC(12,4) NOT NULL,
    exit_date DATE NOT NULL,
    exit_time TIME NOT NULL,
    exit_price NUMERIC(12,4) NOT NULL,
    exit_baseline NUMERIC(12,4) NOT NULL,
    exit_btc_price NUMERIC(12,4) NOT NULL,
    position_type VARCHAR(5) NOT NULL CHECK (position_type IN ('LONG', 'SHORT')),
    shares INTEGER NOT NULL,
    trade_return NUMERIC(10,6) NOT NULL,
    stock_delta NUMERIC(10,6),
    btc_delta NUMERIC(10,6),
    session_type VARCHAR(10) NOT NULL DEFAULT 'ALL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_precomp_all_symbol ON precomputed_trades_all(symbol);
CREATE INDEX idx_precomp_all_method ON precomputed_trades_all(method);
CREATE INDEX idx_precomp_all_entry_date ON precomputed_trades_all(entry_date);
CREATE INDEX idx_precomp_all_params ON precomputed_trades_all(symbol, method, buy_threshold, sell_threshold);

CREATE TABLE IF NOT EXISTS simulation_state_rth (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    buy_threshold NUMERIC(10,4) NOT NULL,
    sell_threshold NUMERIC(10,4) NOT NULL,
    allow_shorts BOOLEAN NOT NULL DEFAULT false,
    conservative_pricing BOOLEAN NOT NULL DEFAULT true,
    slippage NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    has_position BOOLEAN NOT NULL DEFAULT false,
    position_type VARCHAR(5) CHECK (position_type IN ('LONG', 'SHORT')),
    entry_date DATE,
    entry_time TIME,
    entry_price NUMERIC(12,4),
    entry_baseline NUMERIC(12,4),
    entry_btc_price NUMERIC(12,4),
    shares INTEGER,
    last_processed_date DATE,
    session_type VARCHAR(10) NOT NULL DEFAULT 'RTH',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, method, buy_threshold, sell_threshold, allow_shorts, conservative_pricing, slippage, session_type)
);

CREATE TABLE IF NOT EXISTS simulation_state_all (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    method VARCHAR(20) NOT NULL,
    buy_threshold NUMERIC(10,4) NOT NULL,
    sell_threshold NUMERIC(10,4) NOT NULL,
    allow_shorts BOOLEAN NOT NULL DEFAULT false,
    conservative_pricing BOOLEAN NOT NULL DEFAULT true,
    slippage NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    has_position BOOLEAN NOT NULL DEFAULT false,
    position_type VARCHAR(5) CHECK (position_type IN ('LONG', 'SHORT')),
    entry_date DATE,
    entry_time TIME,
    entry_price NUMERIC(12,4),
    entry_baseline NUMERIC(12,4),
    entry_btc_price NUMERIC(12,4),
    shares INTEGER,
    last_processed_date DATE,
    session_type VARCHAR(10) NOT NULL DEFAULT 'ALL',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, method, buy_threshold, sell_threshold, allow_shorts, conservative_pricing, slippage, session_type)
);

CREATE TABLE IF NOT EXISTS processing_log (
    id SERIAL PRIMARY KEY,
    process_date DATE NOT NULL,
    session_type VARCHAR(10) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    combinations_processed INTEGER,
    trades_created INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verify tables created
SELECT 'Tables created successfully!' as status;