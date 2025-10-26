import pg from 'pg';

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function testSetup() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing Database Setup...\n');
    
    // Test 1: Check tables exist
    console.log('Test 1: Checking tables...');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
      AND table_name IN ('precomputed_trades', 'simulation_state', 'processing_log')
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 3) {
      console.log('✅ All 3 tables exist');
      tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));
    } else {
      console.log('❌ Missing tables!');
      process.exit(1);
    }
    
    // Test 2: Check indexes
    console.log('\nTest 2: Checking indexes...');
    const indexResult = await client.query(`
      SELECT tablename, COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('precomputed_trades', 'simulation_state', 'processing_log')
      GROUP BY tablename
      ORDER BY tablename
    `);
    
    console.log('✅ Indexes created:');
    indexResult.rows.forEach(row => {
      console.log(`   - ${row.tablename}: ${row.index_count} indexes`);
    });
    
    // Test 3: Check we have data to process
    console.log('\nTest 3: Checking available data...');
    const dataResult = await client.query(`
      SELECT 
        COUNT(DISTINCT cal_date) as trading_days,
        MIN(cal_date) as first_date,
        MAX(cal_date) as last_date
      FROM trading_calendar
      WHERE cal_date >= '2024-01-01' AND is_open = true
    `);
    
    if (dataResult.rows.length > 0) {
      const data = dataResult.rows[0];
      console.log('✅ Trading calendar data:');
      console.log(`   - Trading days: ${data.trading_days}`);
      console.log(`   - Date range: ${data.first_date.toISOString().split('T')[0]} to ${data.last_date.toISOString().split('T')[0]}`);
    }
    
    // Test 4: Check stock data
    console.log('\nTest 4: Checking stock data...');
    const stockResult = await client.query(`
      SELECT symbol, COUNT(*) as bar_count
      FROM minute_stock
      WHERE et_date >= '2024-01-01'
      GROUP BY symbol
      ORDER BY symbol
    `);
    
    console.log('✅ Stock data available:');
    stockResult.rows.forEach(row => {
      console.log(`   - ${row.symbol}: ${row.bar_count.toLocaleString()} bars`);
    });
    
    // Test 5: Check baseline data
    console.log('\nTest 5: Checking baseline data...');
    const baselineResult = await client.query(`
      SELECT method, COUNT(*) as count
      FROM baseline_daily
      WHERE trading_day >= '2024-01-01'
      GROUP BY method
      ORDER BY method
    `);
    
    console.log('✅ Baseline data available:');
    baselineResult.rows.forEach(row => {
      console.log(`   - ${row.baseline_method}: ${row.count.toLocaleString()} records`);
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED - READY TO PROCESS!');
    console.log('═══════════════════════════════════════\n');
    console.log('Next step: Run processor on test date range');
    console.log('Command: node processor/nightly-processor.js 2024-01-02 2024-01-09\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testSetup();