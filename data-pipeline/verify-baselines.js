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

async function verifyBaseline(client, date, symbol, method, session = 'RTH') {
  const result = await client.query(`
    SELECT 
      baseline,
      sample_count,
      min_ratio,
      max_ratio,
      std_dev
    FROM baseline_daily
    WHERE trading_day = $1
    AND symbol = $2
    AND method = $3
    AND session = $4
  `, [date, symbol, method, session]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
}

async function showSampleBaselines(client) {
  console.log('📊 Sample Baselines (Recent Data):\n');
  
  const result = await client.query(`
    SELECT 
      trading_day,
      symbol,
      method,
      session,
      baseline,
      sample_count
    FROM baseline_daily
    WHERE trading_day >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY trading_day DESC, symbol, method
    LIMIT 50
  `);
  
  if (result.rows.length === 0) {
    console.log('   ❌ No recent baselines found\n');
    return;
  }
  
  let currentDate = null;
  let currentSymbol = null;
  
  for (const row of result.rows) {
    const date = row.trading_day.toISOString().split('T')[0];
    
    if (date !== currentDate) {
      if (currentDate !== null) console.log('');
      console.log(`   📅 ${date}`);
      currentDate = date;
      currentSymbol = null;
    }
    
    if (row.symbol !== currentSymbol) {
      console.log(`      ${row.symbol}:`);
      currentSymbol = row.symbol;
    }
    
    console.log(`         ${row.method.padEnd(20)} ${row.session} - ${parseFloat(row.baseline).toFixed(2).padStart(10)} (${row.sample_count} samples)`);
  }
  
  console.log('');
}

async function compareWithPython(client, date, symbol, method, pythonValue) {
  console.log(`\n🔍 Comparing with Python Tool:`);
  console.log(`   Date: ${date}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Method: ${method}\n`);
  
  const result = await verifyBaseline(client, date, symbol, method);
  
  if (!result) {
    console.log(`   ❌ No baseline found in database\n`);
    return;
  }
  
  const ourValue = parseFloat(result.baseline);
  const theirValue = parseFloat(pythonValue);
  const diff = Math.abs(ourValue - theirValue);
  const diffPct = (diff / theirValue * 100).toFixed(4);
  
  console.log(`   Our Value:    ${ourValue.toFixed(2)}`);
  console.log(`   Python Value: ${theirValue.toFixed(2)}`);
  console.log(`   Difference:   ${diff.toFixed(2)} (${diffPct}%)`);
  
  if (diffPct < 0.01) {
    console.log(`   ✅ MATCH! (within 0.01%)\n`);
  } else if (diffPct < 0.1) {
    console.log(`   ⚠️  Close (within 0.1%)\n`);
  } else {
    console.log(`   ❌ MISMATCH! (difference > 0.1%)\n`);
  }
  
  console.log(`   Additional Info:`);
  console.log(`      Sample Count: ${result.sample_count}`);
  console.log(`      Min Ratio:    ${parseFloat(result.min_ratio).toFixed(2)}`);
  console.log(`      Max Ratio:    ${parseFloat(result.max_ratio).toFixed(2)}`);
  console.log(`      Std Dev:      ${parseFloat(result.std_dev).toFixed(2)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('🚀 TRADIAC Baseline Verifier');
  console.log('═══════════════════════════════════════\n');
  
  const client = await pool.connect();
  
  try {
    // Show sample baselines
    await showSampleBaselines(client);
    
    // If comparison values provided
    if (args.length >= 4) {
      const [date, symbol, method, pythonValue] = args;
      await compareWithPython(client, date, symbol, method, pythonValue);
    } else {
      console.log('💡 To compare with Python tool, run:');
      console.log('   node verify-baselines.js <date> <symbol> <method> <python-value>');
      console.log('   Example: node verify-baselines.js 2024-01-15 RIOT EQUAL_MEAN 6961.72\n');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('✅ VERIFICATION COMPLETE\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();