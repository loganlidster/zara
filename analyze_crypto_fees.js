// Crypto Trading Fee Break-Even Analysis
// Helps determine minimum profitable buy/sell thresholds

const FEE_PER_TRADE = 0.003; // 0.3% per trade
const ROUND_TRIP_FEE = FEE_PER_TRADE * 2; // 0.6% total (buy + sell)

console.log('=== CRYPTO TRADING FEE ANALYSIS ===\n');
console.log(`Fee per trade: ${(FEE_PER_TRADE * 100).toFixed(2)}%`);
console.log(`Round-trip fee (buy + sell): ${(ROUND_TRIP_FEE * 100).toFixed(2)}%\n`);

console.log('=== BREAK-EVEN SCENARIOS ===\n');

// Scenario 1: Buy at baseline, sell above
console.log('Scenario 1: Buy at baseline (0%), sell above');
console.log('Break-even sell threshold: 0.6% (covers round-trip fees)');
console.log('Profitable sell thresholds: 0.7%+ (0.1%+ profit after fees)\n');

// Scenario 2: Buy below baseline, sell at baseline
console.log('Scenario 2: Buy below baseline, sell at baseline (0%)');
console.log('Break-even buy threshold: -0.6% (covers round-trip fees)');
console.log('Profitable buy thresholds: -0.7% or lower (0.1%+ profit after fees)\n');

// Scenario 3: Buy below, sell above
console.log('Scenario 3: Buy below baseline, sell above baseline');
console.log('Example: Buy at -1.0%, sell at +1.0%');
console.log('  Gross profit: 2.0%');
console.log('  Fees: 0.6%');
console.log('  Net profit: 1.4%\n');

// Generate profitable combinations table
console.log('=== PROFITABLE COMBINATIONS (Net Profit After Fees) ===\n');
console.log('Buy%    Sell%   Gross%  Fees%   Net%    Profitable?');
console.log('------  ------  ------  ------  ------  -----------');

const buyThresholds = [0, -0.5, -1.0, -1.5, -2.0];
const sellThresholds = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

for (const buy of buyThresholds) {
  for (const sell of sellThresholds) {
    const grossProfit = sell - buy;
    const netProfit = grossProfit - ROUND_TRIP_FEE * 100;
    const profitable = netProfit > 0 ? 'YES' : 'NO';
    
    console.log(
      `${buy.toFixed(1).padStart(6)}  ` +
      `${sell.toFixed(1).padStart(6)}  ` +
      `${grossProfit.toFixed(1).padStart(6)}  ` +
      `${(ROUND_TRIP_FEE * 100).toFixed(1).padStart(6)}  ` +
      `${netProfit.toFixed(1).padStart(6)}  ` +
      `${profitable.padStart(11)}`
    );
  }
  console.log('');
}

console.log('\n=== RECOMMENDED THRESHOLD RANGES ===\n');
console.log('Minimum profitable spread: 0.7% (0.1% net after 0.6% fees)');
console.log('Conservative range: 1.0% - 3.0% (0.4% - 2.4% net profit)');
console.log('Aggressive range: 0.7% - 2.0% (0.1% - 1.4% net profit)\n');

console.log('=== SUGGESTED GRID SEARCH PARAMETERS ===\n');
console.log('Option 1 (Conservative):');
console.log('  Buy: 0% (at baseline)');
console.log('  Sell: 1.0% to 3.0% in 0.2% increments (11 values)');
console.log('  Total combinations: 11');
console.log('  Net profit range: 0.4% to 2.4%\n');

console.log('Option 2 (Moderate):');
console.log('  Buy: 0%, -0.5%, -1.0% (3 values)');
console.log('  Sell: 1.0% to 3.0% in 0.2% increments (11 values)');
console.log('  Total combinations: 33');
console.log('  Net profit range: 0.4% to 3.4%\n');

console.log('Option 3 (Aggressive):');
console.log('  Buy: 0%, -0.5%, -1.0%, -1.5%, -2.0% (5 values)');
console.log('  Sell: 0.7% to 3.0% in 0.1% increments (24 values)');
console.log('  Total combinations: 120');
console.log('  Net profit range: 0.1% to 4.4%\n');

console.log('Option 4 (Wide Range):');
console.log('  Buy: 0% to -2.0% in 0.2% increments (11 values)');
console.log('  Sell: 1.0% to 3.0% in 0.2% increments (11 values)');
console.log('  Total combinations: 121');
console.log('  Net profit range: 0.4% to 4.4%\n');