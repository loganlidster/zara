import pg from 'pg';

const pool = new pg.Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

async function checkSymbols() {
  try {
    // Get unique symbols from database
    const result = await pool.query(`
      SELECT DISTINCT symbol 
      FROM trade_events_crypto_equal_mean 
      ORDER BY symbol
    `);
    
    const dbSymbols = result.rows.map(r => r.symbol);
    
    console.log('\n=== CRYPTO SYMBOLS IN DATABASE ===');
    console.log(`Total: ${dbSymbols.length}`);
    console.log(dbSymbols.join(', '));
    
    // Hardcoded list in frontend
    const frontendSymbols = ['ADA', 'AVAX', 'BCH', 'CUSD', 'DAI', 'DOGE', 'ETH', 'HBAR', 'HYPE', 'LEO', 'LINK', 'LTC', 'SOL', 'SUI', 'TON', 'TRX', 'TUSD', 'XLM', 'XMR', 'XRP'];
    
    console.log('\n=== CRYPTO SYMBOLS IN FRONTEND ===');
    console.log(`Total: ${frontendSymbols.length}`);
    console.log(frontendSymbols.join(', '));
    
    // Find missing symbols
    const missingInFrontend = dbSymbols.filter(s => !frontendSymbols.includes(s));
    const missingInDB = frontendSymbols.filter(s => !dbSymbols.includes(s));
    
    if (missingInFrontend.length > 0) {
      console.log('\n=== MISSING IN FRONTEND (need to add) ===');
      console.log(missingInFrontend.join(', '));
    }
    
    if (missingInDB.length > 0) {
      console.log('\n=== MISSING IN DATABASE (in frontend but no data) ===');
      console.log(missingInDB.join(', '));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSymbols();
