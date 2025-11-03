import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: false,
  connectionTimeoutMillis: 30000,
});

async function testSingleDay() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing dual processor on 2024-01-02...\n');
    
    // Check if baselines exist
    const baselineCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM baseline_daily
      WHERE trading_day = '2024-01-02'
    `);
    
    console.log(`📊 Baselines for 2024-01-02: ${baselineCheck.rows[0].count}`);
    
    if (baselineCheck.rows[0].count === '0') {
      console.log('❌ No baselines found. Please import baselines first.');
      return;
    }
    
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('precomputed_trades_rth', 'precomputed_trades_all')
    `);
    
    console.log(`📋 Pre-computed tables found: ${tableCheck.rows.length}/2`);
    
    if (tableCheck.rows.length < 2) {
      console.log('❌ Pre-computed tables not found. Please run PASTE_INTO_CLOUD_SQL.sql first.');
      return;
    }
    
    console.log('\n✅ All prerequisites met. Ready to run processor!\n');
    console.log('Run: node processor/nightly-processor-dual.js 2024-01-02 2024-01-02');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testSingleDay();