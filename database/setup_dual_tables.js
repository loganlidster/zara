import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: '34.41.97.179',
  port: 5432,
  database: 'tradiac_testing',
  user: 'postgres',
  password: 'Fu3lth3j3t!',
  ssl: false
});

async function setupDualTables() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Setting up dual pre-computed tables...\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create_precomputed_tables_dual.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    console.log('📝 Executing SQL script...');
    await client.query(sql);
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify tables exist
    console.log('🔍 Verifying tables...');
    const tables = [
      'precomputed_trades_rth',
      'precomputed_trades_all',
      'simulation_state_rth',
      'simulation_state_all',
      'processing_log'
    ];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      
      if (result.rows[0].count === '1') {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - NOT FOUND`);
      }
    }
    
    console.log('\n✅ Dual table setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDualTables();