import pg from 'pg';

const pool = new pg.Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

async function checkEventLogic() {
  try {
    // Get a sample of events with their baselines
    const query = `
      SELECT 
        e.symbol,
        e.buy_pct,
        e.sell_pct,
        e.event_timestamp,
        e.event_type,
        e.crypto_price,
        e.btc_price,
        e.ratio,
        e.baseline
      FROM trade_events_crypto_equal_mean e
      WHERE e.symbol = 'ETH'
        AND e.buy_pct = 1.0
        AND e.sell_pct = 1.0
      ORDER BY e.event_timestamp
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    
    console.log('\n=== SAMPLE EVENTS FOR ETH (1.0% buy, 1.0% sell) ===\n');
    
    for (const row of result.rows) {
      const baseline = parseFloat(row.baseline);
      const ratio = parseFloat(row.ratio);
      const buyPct = parseFloat(row.buy_pct);
      const sellPct = parseFloat(row.sell_pct);
      
      // Calculate what the thresholds SHOULD be
      const correctBuyThreshold = baseline * (1 + buyPct / 100);
      const correctSellThreshold = baseline * (1 - sellPct / 100);
      
      // Calculate what they would be with WRONG formula
      const wrongSellThreshold = baseline * (1 + sellPct / 100);
      
      console.log(`${row.event_timestamp.toISOString().split('T')[0]} ${row.event_type}`);
      console.log(`  Baseline: ${baseline.toFixed(2)}`);
      console.log(`  Ratio: ${ratio.toFixed(2)}`);
      console.log(`  Correct Buy Threshold: ${correctBuyThreshold.toFixed(2)} (baseline * 1.01)`);
      console.log(`  Correct Sell Threshold: ${correctSellThreshold.toFixed(2)} (baseline * 0.99)`);
      console.log(`  Wrong Sell Threshold: ${wrongSellThreshold.toFixed(2)} (baseline * 1.01)`);
      
      if (row.event_type === 'BUY') {
        console.log(`  ✓ BUY: ratio (${ratio.toFixed(2)}) >= buyThreshold (${correctBuyThreshold.toFixed(2)})?`, ratio >= correctBuyThreshold);
      } else {
        console.log(`  ✓ SELL with correct formula: ratio (${ratio.toFixed(2)}) <= sellThreshold (${correctSellThreshold.toFixed(2)})?`, ratio <= correctSellThreshold);
        console.log(`  ✗ SELL with wrong formula: ratio (${ratio.toFixed(2)}) >= sellThreshold (${wrongSellThreshold.toFixed(2)})?`, ratio >= wrongSellThreshold);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkEventLogic();
