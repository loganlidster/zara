import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function setupTables() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create simulation_cache table
    console.log('📊 Creating simulation_cache table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_cache (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        session VARCHAR(10) NOT NULL,
        method VARCHAR(50) NOT NULL,
        buy_pct NUMERIC(5,2) NOT NULL,
        sell_pct NUMERIC(5,2) NOT NULL,
        initial_capital NUMERIC(12,2) DEFAULT 10000,
        allow_shorts BOOLEAN DEFAULT false,
        conservative_pricing BOOLEAN DEFAULT true,
        slippage NUMERIC(5,2) DEFAULT 0,
        total_return NUMERIC(10,2),
        final_equity NUMERIC(12,2),
        total_trades INTEGER,
        winning_trades INTEGER,
        losing_trades INTEGER,
        win_rate NUMERIC(5,2),
        avg_win NUMERIC(10,2),
        avg_loss NUMERIC(10,2),
        max_drawdown NUMERIC(10,2),
        computed_at TIMESTAMP DEFAULT NOW(),
        computation_time_ms INTEGER,
        UNIQUE(symbol, start_date, end_date, session, method, buy_pct, sell_pct, 
               initial_capital, allow_shorts, conservative_pricing, slippage)
      )
    `);
    console.log('✅ simulation_cache table created');

    // Create indexes
    console.log('📊 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cache_lookup 
        ON simulation_cache(symbol, start_date, end_date, session, method)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cache_performance 
        ON simulation_cache(total_return DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cache_symbol_method 
        ON simulation_cache(symbol, method)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cache_params 
        ON simulation_cache(buy_pct, sell_pct)
    `);
    console.log('✅ Indexes created');

    // Create batch_jobs table
    console.log('📊 Creating batch_jobs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_jobs (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        symbols TEXT[],
        methods TEXT[],
        buy_pct_min NUMERIC(5,2),
        buy_pct_max NUMERIC(5,2),
        sell_pct_min NUMERIC(5,2),
        sell_pct_max NUMERIC(5,2),
        start_date DATE,
        end_date DATE,
        session VARCHAR(10),
        total_simulations INTEGER,
        completed_simulations INTEGER DEFAULT 0,
        cached_simulations INTEGER DEFAULT 0,
        failed_simulations INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        best_result JSONB,
        top_10_results JSONB,
        error_message TEXT
      )
    `);
    console.log('✅ batch_jobs table created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_jobs_status 
        ON batch_jobs(status, started_at DESC)
    `);
    console.log('✅ batch_jobs index created');

    console.log('\n🎉 All tables and indexes created successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

setupTables();