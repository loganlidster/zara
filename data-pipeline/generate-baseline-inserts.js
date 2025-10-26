import fs from 'fs';
import { parse } from 'csv-parse/sync';

console.log('📊 Generating SQL INSERT statements from baseline_daily2.csv...\n');

// Read CSV file
const csvContent = fs.readFileSync('/workspace/baseline_daily2.csv', 'utf8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

console.log(`📝 Found ${records.length} baseline records\n`);

// Generate SQL file
let sql = `-- ============================================================================
-- BASELINE DATA INSERT STATEMENTS
-- Generated from baseline_daily2.csv
-- Total records: ${records.length}
-- ============================================================================

-- First, add session column if it doesn't exist
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

-- Drop old constraint
ALTER TABLE baseline_daily DROP CONSTRAINT IF EXISTS baseline_daily_trading_day_symbol_method_key;

-- Add new constraint with session
ALTER TABLE baseline_daily 
ADD CONSTRAINT baseline_daily_unique 
UNIQUE (trading_day, session, symbol, method);

-- Clear existing data
DELETE FROM baseline_daily;

-- Insert baseline data
`;

// Generate INSERT statements in batches of 1000
const batchSize = 1000;
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  
  sql += `\nINSERT INTO baseline_daily (trading_day, session, symbol, method, baseline) VALUES\n`;
  
  const values = batch.map(record => {
    const date = record.baseline_date;
    const session = record.session;
    const symbol = record.symbol;
    const method = record.method;
    const baseline = parseFloat(record.baseline);
    
    return `  ('${date}', '${session}', '${symbol}', '${method}', ${baseline})`;
  });
  
  sql += values.join(',\n');
  sql += ';\n';
  
  if ((i + batchSize) % 5000 === 0) {
    console.log(`  Generated ${Math.min(i + batchSize, records.length)} / ${records.length} inserts`);
  }
}

sql += `\n-- Verify import
SELECT 
    session,
    COUNT(*) as count,
    MIN(trading_day) as first_date,
    MAX(trading_day) as last_date
FROM baseline_daily
GROUP BY session
ORDER BY session;

-- Compare with known values (2024-01-02, RTH, RIOT)
SELECT method, baseline
FROM baseline_daily
WHERE trading_day = '2024-01-02'
  AND session = 'RTH'
  AND symbol = 'RIOT'
ORDER BY method;
`;

// Write to file
fs.writeFileSync('/workspace/data-pipeline/INSERT_BASELINES.sql', sql);

console.log(`\n✅ Generated INSERT_BASELINES.sql with ${records.length} records`);
console.log('📁 File location: /workspace/data-pipeline/INSERT_BASELINES.sql');
console.log('\n📋 Next step: Copy and paste this file into Cloud SQL Editor');