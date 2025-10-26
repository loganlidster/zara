import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tradiac_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function setupTables() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database table setup...\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'create_precomputed_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executing SQL script...');
    await client.query(sql);
    
    console.log('✅ SQL script executed successfully!\n');
    
    // Verify tables
    console.log('🔍 Verifying table creation...\n');
    
    const verifyQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name IN ('precomputed_trades', 'simulation_state', 'processing_log')
      ORDER BY table_name;
    `;
    
    const result = await client.query(verifyQuery);
    
    console.log('📊 Tables Created:');
    console.log('─────────────────────────────────────');
    result.rows.forEach(row => {
      console.log(`✓ ${row.table_name.padEnd(25)} (${row.column_count} columns)`);
    });
    
    // Verify indexes
    const indexQuery = `
      SELECT 
        tablename,
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('precomputed_trades', 'simulation_state', 'processing_log')
      GROUP BY tablename
      ORDER BY tablename;
    `;
    
    const indexResult = await client.query(indexQuery);
    
    console.log('\n📑 Indexes Created:');
    console.log('─────────────────────────────────────');
    indexResult.rows.forEach(row => {
      console.log(`✓ ${row.tablename.padEnd(25)} (${row.index_count} indexes)`);
    });
    
    console.log('\n✅ Database setup complete!\n');
    console.log('🎯 Ready for Step 2: Building the nightly processor\n');
    
  } catch (error) {
    console.error('❌ Error setting up tables:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup
setupTables();