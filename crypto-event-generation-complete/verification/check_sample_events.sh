#!/bin/bash
# View sample events for ETH with 1.0% buy/sell thresholds

PGPASSWORD='Fu3lth3j3t!' psql -h 34.41.97.179 -U postgres -d tradiac_testing << 'EOF'
SELECT 
  symbol,
  buy_pct,
  sell_pct,
  event_timestamp,
  event_type,
  crypto_price,
  btc_price,
  ratio,
  baseline,
  trade_roi_pct
FROM trade_events_crypto_equal_mean 
WHERE symbol = 'ETH' 
  AND buy_pct = 1.0 
  AND sell_pct = 1.0 
ORDER BY event_timestamp 
LIMIT 10;
EOF