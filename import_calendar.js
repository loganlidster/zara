const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function importTradingCalendar() {
  const client = new Client({
    host: process.env.DB_HOST || '34.41.97.179',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'tradiac_testing',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Create table
    console.log('\nCreating trading_calendar table...');
    const createTableSQL = fs.readFileSync('import_calendar.sql', 'utf8');
    await client.query(createTableSQL);
    console.log('Table created successfully!');

    // Read CSV file
    console.log('\nReading CSV file...');
    const csvContent = fs.readFileSync('studio_results_20251024_0333.csv', 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    console.log(`Found ${lines.length - 1} rows to import`);

    // Parse and insert data
    let imported = 0;
    let skipped = 0;
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!values || values.length < 8) {
        skipped++;
        continue;
      }

      const cleanValue = (val) => {
        if (!val) return null;
        val = val.replace(/^"|"$/g, '').trim();
        return val === '' ? null : val;
      };

      const calDate = cleanValue(values[0])?.split('T')[0];
      const dayOfWeek = cleanValue(values[1]);
      const isOpen = cleanValue(values[2]) === 'true';
      const sessionOpenEt = cleanValue(values[3])?.split('T')[1]?.substring(0, 8);
      const sessionCloseEt = cleanValue(values[4])?.split('T')[1]?.substring(0, 8);
      const prevOpenDate = cleanValue(values[5])?.split('T')[0];
      const nextOpenDate = cleanValue(values[6])?.split('T')[0];
      const notes = cleanValue(values[7]);

      try {
        await client.query(`
          INSERT INTO trading_calendar (
            cal_date, day_of_week, is_open, 
            session_open_et, session_close_et,
            prev_open_date, next_open_date, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (cal_date) DO NOTHING
        `, [calDate, dayOfWeek, isOpen, sessionOpenEt, sessionCloseEt, 
            prevOpenDate, nextOpenDate, notes]);
        
        imported++;
        if (imported % 100 === 0) {
          process.stdout.write(`\rImported ${imported} rows...`);
        }
      } catch (err) {
        console.error(`\nError importing row ${i}:`, err.message);
        skipped++;
      }
    }

    console.log(`\n\nImport complete!`);
    console.log(`- Imported: ${imported} rows`);
    console.log(`- Skipped: ${skipped} rows`);

    // Verify import
    console.log('\nVerifying import...');
    const countResult = await client.query('SELECT COUNT(*) FROM trading_calendar');
    console.log(`Total rows in table: ${countResult.rows[0].count}`);

    // Test Monday lookup
    console.log('\nTesting Monday lookup (2025-10-20):');
    const mondayTest = await client.query(`
      SELECT cal_date, day_of_week, prev_open_date 
      FROM trading_calendar 
      WHERE cal_date = '2025-10-20'
    `);
    if (mondayTest.rows.length > 0) {
      console.log('Result:', mondayTest.rows[0]);
      console.log('Expected prev_open_date: 2025-10-17 (Friday)');
    }

    // Test holiday lookup
    console.log('\nTesting holiday lookup:');
    const holidayTest = await client.query(`
      SELECT cal_date, day_of_week, prev_open_date, notes
      FROM trading_calendar 
      WHERE notes LIKE '%Holiday%'
      LIMIT 5
    `);
    console.log('Holidays found:', holidayTest.rows.length);
    holidayTest.rows.forEach(row => {
      console.log(`  ${row.cal_date} (${row.day_of_week}): ${row.notes}`);
    });

    console.log('\n✅ Trading calendar import complete!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  importTradingCalendar()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { importTradingCalendar };