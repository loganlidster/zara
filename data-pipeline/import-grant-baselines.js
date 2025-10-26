import pg from 'pg';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const { Pool } = pg;

const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

async function importGrantBaselines() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Importing Grant\'s baseline data...\n');
    
    // Read CSV file
    const csvContent = fs.readFileSync('/workspace/baseline_daily2.csv', 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`📝 Found ${records.length} baseline records\n`);
    
    // Clear existing baselines (optional - comment out if you want to keep existing)
    console.log('🗑️  Clearing existing baselines...');
    await client.query('DELETE FROM baseline_daily');
    console.log('✅ Cleared\n');
    
    // Prepare batch insert
    console.log('💾 Inserting baselines in batches...');
    const batchSize = 1000;
    let inserted = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Build values array
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const record of batch) {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
        );
        
        values.push(
          record.baseline_date,
          record.session,
          record.symbol,
          record.method,
          parseFloat(record.baseline)
        );
        
        paramIndex += 5;
      }
      
      const query = `
        INSERT INTO baseline_daily (trading_day, session, symbol, method, baseline)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (trading_day, session, symbol, method) DO UPDATE
        SET baseline = EXCLUDED.baseline
      `;
      
      await client.query(query, values);
      inserted += batch.length;
      
      if (inserted % 5000 === 0) {
        console.log(`  ✅ Inserted ${inserted} / ${records.length}`);
      }
    }
    
    console.log(`\n✅ Successfully imported ${inserted} baselines!\n`);
    
    // Verify import
    console.log('🔍 Verifying import...');
    const verifyQuery = `
      SELECT 
        session,
        COUNT(*) as count,
        MIN(trading_day) as first_date,
        MAX(trading_day) as last_date
      FROM baseline_daily
      GROUP BY session
      ORDER BY session
    `;
    
    const result = await client.query(verifyQuery);
    console.log('\n📊 Import Summary:');
    console.table(result.rows);
    
    // Compare with Grant's known value
    console.log('\n🎯 Comparing with Grant\'s known values...');
    const compareQuery = `
      SELECT method, baseline
      FROM baseline_daily
      WHERE trading_day = '2024-01-02'
        AND session = 'RTH'
        AND symbol = 'RIOT'
      ORDER BY method
    `;
    
    const compareResult = await client.query(compareQuery);
    console.log('\n2024-01-02 RTH RIOT Baselines:');
    console.table(compareResult.rows);
    
  } catch (error) {
    console.error('❌ Error importing baselines:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importGrantBaselines();