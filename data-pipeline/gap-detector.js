import pg from 'pg';

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || '34.41.97.179',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Fu3lth3j3t!',
  ssl: { rejectUnauthorized: false }
});

const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];

async function detectGaps() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 TRADIAC Data Gap Detector');
    console.log('═══════════════════════════════════════\n');
    
    // Get date range from trading calendar
    const calendarResult = await client.query(`
      SELECT MIN(cal_date) as start_date, MAX(cal_date) as end_date, COUNT(*) as total_days
      FROM trading_calendar
      WHERE is_open = true
      AND cal_date >= '2024-01-01'
    `);
    
    const { start_date, end_date, total_days } = calendarResult.rows[0];
    console.log(`📅 Trading Calendar:`);
    console.log(`   Range: ${start_date.toISOString().split('T')[0]} to ${end_date.toISOString().split('T')[0]}`);
    console.log(`   Trading Days: ${total_days}\n`);
    
    // Check BTC data
    console.log('📊 BTC Data (X:USDBTC):');
    const btcResult = await client.query(`
      SELECT 
        COUNT(DISTINCT et_date) as days_with_data,
        MIN(et_date) as first_date,
        MAX(et_date) as last_date,
        COUNT(*) as total_bars
      FROM minute_btc
      WHERE et_date >= '2024-01-01'
    `);
    
    if (btcResult.rows.length > 0) {
      const btc = btcResult.rows[0];
      console.log(`   Days with data: ${btc.days_with_data}/${total_days}`);
      console.log(`   Date range: ${btc.first_date?.toISOString().split('T')[0]} to ${btc.last_date?.toISOString().split('T')[0]}`);
      console.log(`   Total bars: ${btc.total_bars.toLocaleString()}`);
      
      if (parseInt(btc.days_with_data) < parseInt(total_days)) {
        console.log(`   ⚠️  MISSING ${parseInt(total_days) - parseInt(btc.days_with_data)} DAYS OF BTC DATA!`);
      } else {
        console.log(`   ✅ Complete`);
      }
    } else {
      console.log(`   ❌ NO BTC DATA FOUND!`);
    }
    
    console.log('\n📊 Stock Data:');
    
    for (const symbol of STOCKS) {
      const stockResult = await client.query(`
        SELECT 
          COUNT(DISTINCT et_date) as days_with_data,
          MIN(et_date) as first_date,
          MAX(et_date) as last_date,
          COUNT(*) as total_bars
        FROM minute_stock
        WHERE symbol = $1
        AND et_date >= '2024-01-01'
      `, [symbol]);
      
      if (stockResult.rows.length > 0 && stockResult.rows[0].days_with_data) {
        const stock = stockResult.rows[0];
        const missing = parseInt(total_days) - parseInt(stock.days_with_data);
        const status = missing === 0 ? '✅' : '⚠️';
        
        console.log(`   ${status} ${symbol.padEnd(6)} - ${stock.days_with_data}/${total_days} days | ${stock.total_bars.toLocaleString().padStart(8)} bars${missing > 0 ? ` | MISSING ${missing} days` : ''}`);
      } else {
        console.log(`   ❌ ${symbol.padEnd(6)} - NO DATA FOUND!`);
      }
    }
    
    // Check for specific date gaps
    console.log('\n🔍 Detecting Date Gaps...');
    
    const gapResult = await client.query(`
      WITH trading_days AS (
        SELECT cal_date
        FROM trading_calendar
        WHERE is_open = true
        AND cal_date >= '2024-01-01'
        ORDER BY cal_date
      ),
      btc_days AS (
        SELECT DISTINCT et_date
        FROM minute_btc
        WHERE et_date >= '2024-01-01'
      )
      SELECT td.cal_date
      FROM trading_days td
      LEFT JOIN btc_days bd ON td.cal_date = bd.et_date
      WHERE bd.et_date IS NULL
      ORDER BY td.cal_date
      LIMIT 20
    `);
    
    if (gapResult.rows.length > 0) {
      console.log(`\n   ⚠️  BTC Data Gaps (first 20):`);
      gapResult.rows.forEach(row => {
        console.log(`      - ${row.cal_date.toISOString().split('T')[0]}`);
      });
    } else {
      console.log(`   ✅ No BTC gaps detected`);
    }
    
    // Check baselines
    console.log('\n📊 Baseline Data:');
    const baselineResult = await client.query(`
      SELECT 
        method,
        COUNT(*) as count,
        COUNT(DISTINCT symbol) as symbols,
        COUNT(DISTINCT trading_day) as days
      FROM baseline_daily
      WHERE trading_day >= '2024-01-01'
      GROUP BY method
      ORDER BY method
    `);
    
    if (baselineResult.rows.length > 0) {
      baselineResult.rows.forEach(row => {
        const expected = STOCKS.length * parseInt(total_days) * 2; // RTH + AH
        const pct = ((row.count / expected) * 100).toFixed(1);
        console.log(`   ${row.method.padEnd(20)} - ${row.count.toLocaleString().padStart(6)} records (${pct}% complete)`);
      });
    } else {
      console.log(`   ❌ NO BASELINE DATA FOUND!`);
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Gap Detection Complete\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

detectGaps();