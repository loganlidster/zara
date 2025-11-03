import pg from 'pg';

const pool = new pg.Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

async function detailedCheck() {
  try {
    // Get consecutive BUY/SELL pairs
    const query = `
      SELECT 
        event_timestamp,
        event_type,
        crypto_price,
        btc_price,
        ratio,
        baseline,
        buy_pct,
        sell_pct
      FROM trade_events_crypto_equal_mean
      WHERE symbol = 'ETH'
        AND buy_pct = 1.0
        AND sell_pct = 1.0
        AND DATE(event_timestamp) = '2024-10-01'
      ORDER BY event_timestamp
      LIMIT 6
    `;
    
    const result = await pool.query(query);
    
    console.log('\n=== DETAILED EVENT ANALYSIS ===\n');
    
    let lastBuyRatio = null;
    
    for (const row of result.rows) {
      const baseline = parseFloat(row.baseline);
      const ratio = parseFloat(row.ratio);
      const buyPct = parseFloat(row.buy_pct);
      const sellPct = parseFloat(row.sell_pct);
      
      const buyThreshold = baseline * (1 + buyPct / 100);
      const sellThreshold = baseline * (1 - sellPct / 100);
      
      console.log(`${row.event_timestamp.toISOString()} - ${row.event_type}`);
      console.log(`  Ratio: ${ratio.toFixed(4)}`);
      console.log(`  Baseline: ${baseline.toFixed(4)}`);
      console.log(`  Buy Threshold (baseline * 1.01): ${buyThreshold.toFixed(4)}`);
      console.log(`  Sell Threshold (baseline * 0.99): ${sellThreshold.toFixed(4)}`);
      
      if (row.event_type === 'BUY') {
        const valid = ratio >= buyThreshold;
        console.log(`  BUY valid? ${ratio.toFixed(4)} >= ${buyThreshold.toFixed(4)} = ${valid}`);
        if (valid) console.log(`  ✓ CORRECT`);
        else console.log(`  ✗ WRONG - should not have triggered BUY`);
        lastBuyRatio = ratio;
      } else {
        const valid = ratio <= sellThreshold;
        console.log(`  SELL valid? ${ratio.toFixed(4)} <= ${sellThreshold.toFixed(4)} = ${valid}`);
        if (valid) {
          console.log(`  ✓ CORRECT`);
        } else {
          console.log(`  ✗ WRONG - should not have triggered SELL`);
          console.log(`  Previous BUY was at ratio: ${lastBuyRatio?.toFixed(4)}`);
          console.log(`  Ratio dropped from ${lastBuyRatio?.toFixed(4)} to ${ratio.toFixed(4)}`);
          console.log(`  But ${ratio.toFixed(4)} is still > ${sellThreshold.toFixed(4)}`);
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

detailedCheck();
