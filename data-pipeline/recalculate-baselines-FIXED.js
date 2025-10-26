import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: false,
  connectionTimeoutMillis: 60000,
});

const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];

async function recalculateBaselines(startDate, endDate) {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Recalculating baselines with session awareness...\n');
    console.log(`📅 Date range: ${startDate} to ${endDate}\n`);
    
    // First, add session column if it doesn't exist
    console.log('📝 Checking baseline_daily schema...');
    await client.query(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'baseline_daily' 
              AND column_name = 'session'
          ) THEN
              ALTER TABLE baseline_daily ADD COLUMN session VARCHAR(10);
              UPDATE baseline_daily SET session = 'RTH' WHERE session IS NULL;
              ALTER TABLE baseline_daily ALTER COLUMN session SET NOT NULL;
          END IF;
      END $$;
    `);
    
    // Drop old constraint and add new one with session
    await client.query(`
      ALTER TABLE baseline_daily DROP CONSTRAINT IF EXISTS baseline_daily_trading_day_symbol_method_key;
      ALTER TABLE baseline_daily DROP CONSTRAINT IF EXISTS baseline_daily_unique;
      ALTER TABLE baseline_daily ADD CONSTRAINT baseline_daily_unique UNIQUE (trading_day, session, symbol, method);
    `);
    
    console.log('✅ Schema updated\n');
    
    // Get trading days
    const datesResult = await client.query(`
      SELECT cal_date
      FROM trading_calendar
      WHERE cal_date >= $1 AND cal_date <= $2
        AND is_open = true
      ORDER BY cal_date
    `, [startDate, endDate]);
    
    const tradingDays = datesResult.rows.map(r => r.cal_date);
    console.log(`📅 Found ${tradingDays.length} trading days\n`);
    
    // Clear existing baselines for this date range
    console.log('🗑️  Clearing existing baselines...');
    await client.query(`
      DELETE FROM baseline_daily
      WHERE trading_day >= $1 AND trading_day <= $2
    `, [startDate, endDate]);
    console.log('✅ Cleared\n');
    
    let totalBaselines = 0;
    
    for (const date of tradingDays) {
      console.log(`📊 Processing ${date}...`);
      
      const baselines = [];
      
      for (const symbol of STOCKS) {
        // Calculate RTH baselines (09:30:00 - 16:00:00)
        const rthResult = await client.query(`
          WITH stock_data AS (
            SELECT 
              s.et_time,
              s.close as stock_price,
              s.volume as stock_volume,
              b.close as btc_price
            FROM minute_stock s
            JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
            WHERE s.et_date = $1
              AND s.symbol = $2
              AND s.et_time >= '09:30:00'
              AND s.et_time < '16:00:00'
          )
          SELECT
            -- EQUAL_MEAN (BTC / STOCK - CORRECTED!)
            AVG(btc_price / stock_price) as equal_mean,
            
            -- WEIGHTED_MEDIAN (approximated as median for now)
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY btc_price / stock_price) as weighted_median,
            
            -- VOL_WEIGHTED
            SUM((btc_price / stock_price) * stock_volume) / NULLIF(SUM(stock_volume), 0) as vol_weighted,
            
            -- WINSORIZED (5% trim on each end)
            AVG(ratio) as winsorized,
            
            -- VWAP_RATIO
            (SUM(btc_price * stock_volume) / NULLIF(SUM(stock_volume), 0)) / 
            (SUM(stock_price * stock_volume) / NULLIF(SUM(stock_volume), 0)) as vwap_ratio
          FROM (
            SELECT 
              stock_price,
              btc_price,
              stock_volume,
              btc_price / stock_price as ratio,
              ROW_NUMBER() OVER (ORDER BY btc_price / stock_price) as rn,
              COUNT(*) OVER () as total_count
            FROM stock_data
          ) ranked
          WHERE rn > total_count * 0.05 AND rn <= total_count * 0.95
        `, [date, symbol]);
        
        if (rthResult.rows.length > 0 && rthResult.rows[0].equal_mean) {
          const row = rthResult.rows[0];
          baselines.push(
            { date, session: 'RTH', symbol, method: 'EQUAL_MEAN', baseline: parseFloat(row.equal_mean) },
            { date, session: 'RTH', symbol, method: 'WEIGHTED_MEDIAN', baseline: parseFloat(row.weighted_median) },
            { date, session: 'RTH', symbol, method: 'VOL_WEIGHTED', baseline: parseFloat(row.vol_weighted) },
            { date, session: 'RTH', symbol, method: 'WINSORIZED', baseline: parseFloat(row.winsorized) },
            { date, session: 'RTH', symbol, method: 'VWAP_RATIO', baseline: parseFloat(row.vwap_ratio) }
          );
        }
        
        // Calculate AH baselines (04:00:00 - 09:30:00 and 16:00:00 - 20:00:00)
        const ahResult = await client.query(`
          WITH stock_data AS (
            SELECT 
              s.et_time,
              s.close as stock_price,
              s.volume as stock_volume,
              b.close as btc_price
            FROM minute_stock s
            JOIN minute_btc b ON s.et_date = b.et_date AND s.et_time = b.et_time
            WHERE s.et_date = $1
              AND s.symbol = $2
              AND (
                (s.et_time >= '04:00:00' AND s.et_time < '09:30:00')
                OR
                (s.et_time >= '16:00:00' AND s.et_time < '20:00:00')
              )
          )
          SELECT
            AVG(btc_price / stock_price) as equal_mean,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY btc_price / stock_price) as weighted_median,
            SUM((btc_price / stock_price) * stock_volume) / NULLIF(SUM(stock_volume), 0) as vol_weighted,
            AVG(ratio) as winsorized,
            (SUM(btc_price * stock_volume) / NULLIF(SUM(stock_volume), 0)) / 
            (SUM(stock_price * stock_volume) / NULLIF(SUM(stock_volume), 0)) as vwap_ratio
          FROM (
            SELECT 
              stock_price,
              btc_price,
              stock_volume,
              btc_price / stock_price as ratio,
              ROW_NUMBER() OVER (ORDER BY btc_price / stock_price) as rn,
              COUNT(*) OVER () as total_count
            FROM stock_data
          ) ranked
          WHERE rn > total_count * 0.05 AND rn <= total_count * 0.95
        `, [date, symbol]);
        
        if (ahResult.rows.length > 0 && ahResult.rows[0].equal_mean) {
          const row = ahResult.rows[0];
          baselines.push(
            { date, session: 'AH', symbol, method: 'EQUAL_MEAN', baseline: parseFloat(row.equal_mean) },
            { date, session: 'AH', symbol, method: 'WEIGHTED_MEDIAN', baseline: parseFloat(row.weighted_median) },
            { date, session: 'AH', symbol, method: 'VOL_WEIGHTED', baseline: parseFloat(row.vol_weighted) },
            { date, session: 'AH', symbol, method: 'WINSORIZED', baseline: parseFloat(row.winsorized) },
            { date, session: 'AH', symbol, method: 'VWAP_RATIO', baseline: parseFloat(row.vwap_ratio) }
          );
        }
      }
      
      // Batch insert baselines
      if (baselines.length > 0) {
        const values = [];
        const placeholders = [];
        let paramIndex = 1;
        
        for (const b of baselines) {
          placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
          values.push(b.date, b.session, b.symbol, b.method, b.baseline);
          paramIndex += 5;
        }
        
        await client.query(`
          INSERT INTO baseline_daily (trading_day, session, symbol, method, baseline)
          VALUES ${placeholders.join(', ')}
        `, values);
        
        totalBaselines += baselines.length;
        console.log(`  ✅ Inserted ${baselines.length} baselines`);
      }
    }
    
    console.log(`\n✅ Recalculation complete! Total baselines: ${totalBaselines}\n`);
    
    // Verify against Grant's data
    console.log('🔍 Comparing with Grant\'s baseline data...\n');
    
    const compareResult = await client.query(`
      SELECT method, session, baseline
      FROM baseline_daily
      WHERE trading_day = '2024-01-02'
        AND symbol = 'RIOT'
      ORDER BY session, method
    `);
    
    console.log('Our baselines for 2024-01-02 RIOT:');
    console.table(compareResult.rows);
    
    console.log('\nGrant\'s baselines for 2024-01-02 RIOT (from CSV):');
    console.log('RTH EQUAL_MEAN: 2840.627602246017');
    console.log('RTH MEDIAN: 2832.703842196401');
    console.log('RTH VOL_WEIGHTED: 2823.4080826827244');
    console.log('RTH WINSORIZED: 2842.0204050877223');
    console.log('RTH VWAP_RATIO: 2818.3473406249313');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node recalculate-baselines-with-sessions.js START_DATE END_DATE');
  console.error('Example: node recalculate-baselines-with-sessions.js 2024-01-01 2024-10-26');
  process.exit(1);
}

const [startDate, endDate] = args;
recalculateBaselines(startDate, endDate);