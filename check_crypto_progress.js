import pg from 'pg';

const pool = new pg.Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

async function checkProgress() {
  try {
    // Get counts for both tables
    const equalMeanResult = await pool.query('SELECT COUNT(*) FROM trade_events_crypto_equal_mean');
    const winsorizedResult = await pool.query('SELECT COUNT(*) FROM trade_events_crypto_winsorized');
    
    const equalMeanCount = parseInt(equalMeanResult.rows[0].count);
    const winsorizedCount = parseInt(winsorizedResult.rows[0].count);
    const totalEvents = equalMeanCount + winsorizedCount;
    
    // Get unique symbols processed
    const symbolsResult = await pool.query(`
      SELECT DISTINCT symbol FROM trade_events_crypto_equal_mean
      UNION
      SELECT DISTINCT symbol FROM trade_events_crypto_winsorized
      ORDER BY symbol
    `);
    
    const symbolsProcessed = symbolsResult.rows.map(r => r.symbol);
    
    console.log('\n=== CRYPTO EVENT GENERATION PROGRESS ===\n');
    console.log(`EQUAL_MEAN events: ${equalMeanCount.toLocaleString()}`);
    console.log(`WINSORIZED events: ${winsorizedCount.toLocaleString()}`);
    console.log(`Total events: ${totalEvents.toLocaleString()}`);
    console.log(`\nSymbols processed (${symbolsProcessed.length}/19):`);
    console.log(symbolsProcessed.join(', '));
    
    // Expected: 19 symbols × 2 methods × ~2.5M events = ~95M total
    const expectedTotal = 19 * 2 * 2500000;
    const percentComplete = (totalEvents / expectedTotal * 100).toFixed(1);
    console.log(`\nProgress: ${percentComplete}% complete`);
    console.log(`Expected total: ~${(expectedTotal / 1000000).toFixed(1)}M events`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkProgress();
