/**
 * Run Event-Based Processor in Parallel
 * 
 * Processes multiple symbols simultaneously to speed up processing
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['ALL'];

// Get command line args
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node run-parallel.js <start_date> <end_date> [max_parallel]');
  console.log('Example: node run-parallel.js 2024-01-01 2024-12-31 5');
  process.exit(1);
}

const [startDate, endDate, maxParallel = 5] = args;
const maxConcurrent = parseInt(maxParallel);

console.log('='.repeat(80));
console.log('PARALLEL EVENT-BASED PROCESSOR');
console.log('='.repeat(80));
console.log(`Start Date: ${startDate}`);
console.log(`End Date: ${endDate}`);
console.log(`Max Parallel: ${maxConcurrent}`);
console.log(`Total Groups: ${SYMBOLS.length * METHODS.length * SESSIONS.length}`);
console.log('='.repeat(80));
console.log('');

// Create work queue
const workQueue = [];
for (const symbol of SYMBOLS) {
  for (const method of METHODS) {
    for (const session of SESSIONS) {
      workQueue.push({ symbol, method, session });
    }
  }
}

let completed = 0;
let failed = 0;
let running = 0;
const startTime = Date.now();

function runWorker(work) {
  return new Promise((resolve) => {
    const { symbol, method, session } = work;
    
    console.log(`[START] ${symbol} - ${method} - ${session}`);
    running++;
    
    const worker = spawn('node', [
      join(__dirname, 'process-single-group.js'),
      symbol,
      method,
      session,
      startDate,
      endDate
    ]);

    let output = '';
    
    worker.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.log(`[${symbol}] ${text}`);
      }
      output += text;
    });

    worker.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.error(`[ERROR ${symbol}] ${text}`);
      }
    });

    worker.on('close', (code) => {
      running--;
      
      if (code === 0) {
        completed++;
        console.log(`[DONE] ${symbol} - ${method} - ${session} ✓`);
      } else {
        failed++;
        console.error(`[FAIL] ${symbol} - ${method} - ${session} ✗`);
      }
      
      const total = completed + failed;
      const progress = (total / workQueue.length * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      
      console.log(`Progress: ${total}/${workQueue.length} (${progress}%) - ${completed} done, ${failed} failed, ${running} running - ${elapsed}m elapsed`);
      console.log('');
      
      resolve();
    });
  });
}

async function processQueue() {
  const workers = [];
  
  for (const work of workQueue) {
    // Wait if we're at max concurrent
    if (workers.length >= maxConcurrent) {
      await Promise.race(workers);
      workers.splice(workers.findIndex(w => w.settled), 1);
    }
    
    const promise = runWorker(work);
    promise.then(() => { promise.settled = true; });
    workers.push(promise);
  }
  
  // Wait for all remaining workers
  await Promise.all(workers);
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  
  console.log('='.repeat(80));
  console.log('PROCESSING COMPLETE');
  console.log('='.repeat(80));
  console.log(`Total time: ${totalTime} minutes`);
  console.log(`Completed: ${completed}/${workQueue.length}`);
  console.log(`Failed: ${failed}/${workQueue.length}`);
  console.log('='.repeat(80));
}

processQueue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });