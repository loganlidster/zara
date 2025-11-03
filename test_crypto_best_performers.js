// Test script to verify crypto event data and calculate best performers

const { Pool } = require('pg');

const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
});

async function testBestPerformers() {
  const client = await pool.connect();
  
  try {
    console.log('=== TESTING CRYPTO BEST PERFORMERS ===\n');
    
    // Get a sample of combinations and calculate ROI
    const query = `
      WITH trades AS (
        SELECT 
          symbol,
          buy_pct,
          sell_pct,
          event_type,
          event_timestamp,
          ratio,
          baseline,
          LAG(ratio) OVER (PARTITION BY symbol, buy_pct, sell_pct ORDER BY event_timestamp) as prev_ratio,
          LAG(event_type) OVER (PARTITION BY symbol, buy_pct, sell_pct ORDER BY event_timestamp) as prev_type
        FROM trade_events_crypto_equal_mean
        WHERE symbol = 'ADA'
          AND event_timestamp >= '2024-10-01'
          AND event_timestamp < '2024-11-01'
      ),
      completed_trades AS (
        SELECT 
          symbol,
          buy_pct,
          sell_pct,
          prev_ratio as buy_ratio,
          ratio as sell_ratio,
          ((ratio - prev_ratio) / prev_ratio * 100) as roi_pct
        FROM trades
        WHERE event_type = 'SELL' AND prev_type = 'BUY'
      )
      SELECT 
        symbol,
        buy_pct,
        sell_pct,
        COUNT(*) as num_trades,
        AVG(roi_pct) as avg_roi,
        SUM(CASE WHEN roi_pct > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN roi_pct <= 0 THEN 1 ELSE 0 END) as losses,
        MIN(roi_pct) as min_roi,
        MAX(roi_pct) as max_roi
      FROM completed_trades
      GROUP BY symbol, buy_pct, sell_pct
      HAVING COUNT(*) >= 5
      ORDER BY avg_roi DESC
      LIMIT 10
    `;
    
    const result = await client.query(query);
    
    console.log('Top 10 Performers (October 2024):');
    console.table(result.rows.map(r => ({
      buy: r.buy_pct + '%',
      sell: r.sell_pct + '%',
      trades: parseInt(r.num_trades),
      avg_roi: parseFloat(r.avg_roi).toFixed(2) + '%',
      wins: parseInt(r.wins),
      losses: parseInt(r.losses),
      win_rate: (parseInt(r.wins) / parseInt(r.num_trades) * 100).toFixed(1) + '%',
      min: parseFloat(r.min_roi).toFixed(2) + '%',
      max: parseFloat(r.max_roi).toFixed(2) + '%'
    })));
    
  } finally {
    client.release();
    await pool.end();
  }
}

testBestPerformers().catch(console.error);