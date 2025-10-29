-- Create BTC Hourly Aggregated Table
-- Aggregates minute_btc data into 1-hour bars
-- Reduces from ~1,440 bars/day to 24 bars/day

CREATE TABLE IF NOT EXISTS btc_hourly (
    bar_date DATE NOT NULL,
    bar_hour INTEGER NOT NULL,  -- 0-23
    open_price DECIMAL(12,2) NOT NULL,
    high_price DECIMAL(12,2) NOT NULL,
    low_price DECIMAL(12,2) NOT NULL,
    close_price DECIMAL(12,2) NOT NULL,
    volume BIGINT NOT NULL,
    
    -- Derived metrics
    price_change DECIMAL(12,2),      -- close - open
    price_change_pct DECIMAL(8,4),   -- (close - open) / open * 100
    
    PRIMARY KEY (bar_date, bar_hour)
);

CREATE INDEX idx_btc_hourly_date ON btc_hourly(bar_date);
CREATE INDEX idx_btc_hourly_datetime ON btc_hourly(bar_date, bar_hour);

-- Populate from minute_btc
-- Column names: o (open), h (high), l (low), c (close), v (volume)
INSERT INTO btc_hourly (
    bar_date,
    bar_hour,
    open_price,
    high_price,
    low_price,
    close_price,
    volume,
    price_change,
    price_change_pct
)
SELECT 
    et_date as bar_date,
    EXTRACT(HOUR FROM et_time)::INTEGER as bar_hour,
    
    -- OHLC aggregation (using single-letter column names)
    (ARRAY_AGG(c ORDER BY et_time ASC))[1] as open_price,
    MAX(h) as high_price,
    MIN(l) as low_price,
    (ARRAY_AGG(c ORDER BY et_time DESC))[1] as close_price,
    
    -- Volume sum
    SUM(v) as volume,
    
    -- Derived metrics
    (ARRAY_AGG(c ORDER BY et_time DESC))[1] - 
    (ARRAY_AGG(c ORDER BY et_time ASC))[1] as price_change,
    
    ((ARRAY_AGG(c ORDER BY et_time DESC))[1] - 
     (ARRAY_AGG(c ORDER BY et_time ASC))[1]) / 
    (ARRAY_AGG(c ORDER BY et_time ASC))[1] * 100 as price_change_pct
    
FROM minute_btc
WHERE et_date >= '2024-01-01'  -- Start from Jan 2024
GROUP BY 
    et_date,
    EXTRACT(HOUR FROM et_time)
ORDER BY bar_date, bar_hour;

-- Verify the aggregation
SELECT 
    COUNT(*) as total_bars,
    MIN(bar_date) as first_date,
    MAX(bar_date) as last_date,
    COUNT(DISTINCT bar_date) as unique_days,
    ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT bar_date), 2) as avg_bars_per_day
FROM btc_hourly;

-- Show sample data
SELECT * FROM btc_hourly ORDER BY bar_date DESC, bar_hour DESC LIMIT 20;