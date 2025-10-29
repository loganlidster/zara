// Test script to run the daily update locally
// Usage: POLYGON_API_KEY=your_key node test-daily-update.js [date]

import { spawn } from 'child_process';

const date = process.argv[2] || (() => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
})();

console.log(`Testing daily update for date: ${date}`);
console.log('Make sure you have set POLYGON_API_KEY environment variable\n');

// Set the target date as an environment variable
process.env.TARGET_DATE = date;

// Run the daily update job
const child = spawn('node', ['daily-update-job.js'], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Daily update completed successfully!');
  } else {
    console.log(`\n❌ Daily update failed with code ${code}`);
  }
  process.exit(code);
});