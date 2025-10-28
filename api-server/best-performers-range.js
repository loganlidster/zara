import { Router } from 'express';
import pkg from 'pg';
const { Client } = pkg;

const router = Router();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '/cloudsql/tradiac-testing:us-central1:tradiac-testing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tradiac_testing',
  port: 5432,
};

// Helper to get table name
function getTableName(session, method) {
  const sessionLower = session.toLowerCase();
  const methodLower = method.toLowerCase();
  return `trade_events_${sessionLower}_${methodLower}`;
}

// Generate range of values
function generateRange(min, max, step = 0.1) {
  const values = [];
  let current = min;
  while (current <= max + 0.001) { // Add small epsilon for floating point
    values.push(Math.round(current * 10) / 10); // Round to 1 decimal
    current += step;
  }
  return values;
}

// Fetch events for a specific combination
async function fetchEventsForCombination(client, symbol, method, session, buyPct, sellPct, startDate, endDate) {
  const tableName = getTableName(session, method);
  
  const query = `
    SELECT 
      event_date,
      event_time,
      event_type,
      stock_price,
      btc_price,
      ratio,
      baseline,
      trade_roi_pct
    FROM ${tableName}
    WHERE symbol = $1
      AND buy_pct = $2
      AND sell_pct = $3
      AND event_date >= $4
      AND event_date <= $5
    ORDER BY event_date, event_time
  `;
  
  const result = await client.query(query, [symbol, buyPct, sellPct, startDate, endDate]);
  return result.rows;
}

// Filter to alternating BUY/SELL events
function filterToAlternating(events) {
  const filtered = [];
  let lastType = null;
  
  for (const event of events) {
    if (event.event_type !== lastType) {
      filtered.push(event);
      lastType = event.event_type;
    }
  }
  
  return filtered;
}

// Simulate wallet and calculate true portfolio ROI
function simulateWallet(events, initialCapital = 10000) {
  let cash = initialCapital;
  let shares = 0;
  let trades = 0;
  
  for (const event of events) {
    const price = parseFloat(event.stock_price);
    
    if (event.event_type === 'BUY' && shares === 0) {
      // Buy as many shares as possible
      const sharesToBuy = Math.floor(cash / price);
      if (sharesToBuy > 0) {
        shares = sharesToBuy;
        cash -= sharesToBuy * price;
        trades++;
      }
    } else if (event.event_type === 'SELL' && shares > 0) {
      // Sell all shares
      cash += shares * price;
      shares = 0;
      trades++;
    }
  }
  
  // Calculate final equity
  const lastPrice = events.length > 0 ? parseFloat(events[events.length - 1].stock_price) : 0;
  const finalEquity = cash + (shares * lastPrice);
  const portfolioROI = ((finalEquity - initialCapital) / initialCapital) * 100;
  
  return {
    portfolioROI: portfolioROI,
    finalEquity: finalEquity,
    totalTrades: trades,
    endingShares: shares,
    endingCash: cash
  };
}

// Main endpoint
router.post('/best-performers-range', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbol,
      method,
      session,
      buyMin,
      buyMax,
      sellMin,
      sellMax,
      startDate,
      endDate,
      limit = 20
    } = req.body;
    
    // Validate inputs
    if (!symbol || !method || !session || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'method', 'session', 'buyMin', 'buyMax', 'sellMin', 'sellMax', 'startDate', 'endDate']
      });
    }
    
    if (buyMin === undefined || buyMax === undefined || sellMin === undefined || sellMax === undefined) {
      return res.status(400).json({
        error: 'Missing threshold parameters',
        required: ['buyMin', 'buyMax', 'sellMin', 'sellMax']
      });
    }
    
    // Generate ranges
    const buyValues = generateRange(parseFloat(buyMin), parseFloat(buyMax), 0.1);
    const sellValues = generateRange(parseFloat(sellMin), parseFloat(sellMax), 0.1);
    const totalCombinations = buyValues.length * sellValues.length;
    
    console.log(`Testing ${totalCombinations} combinations (${buyValues.length} buy × ${sellValues.length} sell)...`);
    
    if (totalCombinations > 1000) {
      return res.status(400).json({
        error: 'Too many combinations',
        message: `Requested ${totalCombinations} combinations. Maximum is 1000. Please narrow your range.`,
        suggestion: 'Try a smaller range or larger step size'
      });
    }
    
    const startTime = Date.now();
    const results = [];
    let processed = 0;
    
    // Test each combination
    for (const buyPct of buyValues) {
      for (const sellPct of sellValues) {
        processed++;
        
        try {
          // Fetch events
          const events = await fetchEventsForCombination(
            client, symbol, method, session,
            buyPct, sellPct,
            startDate, endDate
          );
          
          if (events.length === 0) {
            continue; // Skip if no events
          }
          
          // Filter to alternating
          const filteredEvents = filterToAlternating(events);
          
          // Simulate wallet
          const walletResult = simulateWallet(filteredEvents, 10000);
          
          results.push({
            symbol,
            method,
            session,
            buyPct,
            sellPct,
            roiPct: walletResult.portfolioROI,
            totalEvents: events.length,
            totalTrades: walletResult.totalTrades,
            finalEquity: walletResult.finalEquity,
            endingShares: walletResult.endingShares,
            endingCash: walletResult.endingCash
          });
          
          // Log progress every 50 combinations
          if (processed % 50 === 0) {
            console.log(`Progress: ${processed}/${totalCombinations} (${((processed/totalCombinations)*100).toFixed(1)}%)`);
          }
          
        } catch (err) {
          console.error(`Error testing ${buyPct}/${sellPct}:`, err.message);
          // Continue with other combinations
        }
      }
    }
    
    // Sort by ROI
    results.sort((a, b) => b.roiPct - a.roiPct);
    
    // Return top N
    const topPerformers = results.slice(0, parseInt(limit));
    
    const totalTime = Date.now() - startTime;
    const avgTime = results.length > 0 ? totalTime / results.length : 0;
    
    console.log(`Range testing completed in ${totalTime}ms (avg ${avgTime.toFixed(0)}ms per combination)`);
    
    res.json({
      success: true,
      mode: 'range',
      rangeParams: {
        buyMin: parseFloat(buyMin),
        buyMax: parseFloat(buyMax),
        sellMin: parseFloat(sellMin),
        sellMax: parseFloat(sellMax),
        buyValues: buyValues.length,
        sellValues: sellValues.length,
        combinationsTested: results.length,
        combinationsRequested: totalCombinations
      },
      dateRange: { startDate, endDate },
      count: topPerformers.length,
      topPerformers,
      timing: {
        total: totalTime,
        avgPerCombination: Math.round(avgTime)
      }
    });
    
  } catch (error) {
    console.error('Error in best-performers-range:', error);
    res.status(500).json({
      error: 'Failed to test range',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;