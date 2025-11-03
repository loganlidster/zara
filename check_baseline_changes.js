import pg from 'pg';

const pool = new pg.Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

async function checkBaselines() {
  try {
    // Get all unique baselines for ETH on 2024-10-01
    const query = `
      SELECT DISTINCT baseline, COUNT(*) as event_count
      FROM trade_events_crypto_equal_mean
      WHERE symbol = 'ETH'
        AND buy_pct = 1.0
        AND sell_pct = 1.0
        AND DATE(event_timestamp) = '2024-10-01'
      GROUP BY baseline
      ORDER BY baseline
    `;
    
    const result = await pool.query(query);
    
    console.log('\n=== BASELINES FOR ETH ON 2024-10-01 ===\n');
    console.log(`Found ${result.rows.length} different baseline values:\n`);
    
    for (const row of result.rows) {
      console.log(`Baseline: ${parseFloat(row.baseline).toFixed(2)} - ${row.event_count} events`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBaselines();
