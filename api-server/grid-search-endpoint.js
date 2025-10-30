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
      baseline
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

// Simulate wallet and calculate ROI
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
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  
  return {
    totalReturn,
    finalEquity,
    totalTrades: trades,
    endingCash: cash,
    endingShares: shares
  };
}

// Generate range of values
function generateRange(min, max, step) {
  const values = [];
  for (let val = min; val <= max + 0.0001; val += step) {
    values.push(Math.round(val * 10) / 10); // Round to 1 decimal
  }
  return values;
}

// Main grid search endpoint
router.post('/grid-search', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbol,
      methods,
      session,
      buyMin,
      buyMax,
      buyStep,
      sellMin,
      sellMax,
      sellStep,
      startDate,
      endDate,
      initialCapital = 10000
    } = req.body;
    
    // Validate inputs
    if (!symbol || !methods || !Array.isArray(methods) || methods.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid required parameters',
        required: ['symbol', 'methods (array)']
      });
    }
    
    if (!session || buyMin === undefined || buyMax === undefined || buyStep === undefined ||
        sellMin === undefined || sellMax === undefined || sellStep === undefined ||
        !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['session', 'buyMin', 'buyMax', 'buyStep', 'sellMin', 'sellMax', 'sellStep', 'startDate', 'endDate']
      });
    }
    
    console.log(`Grid search for ${symbol}: ${methods.length} methods, ${session} session`);
    const startTime = Date.now();
    
    // Generate buy and sell percentage ranges
    const buyValues = generateRange(parseFloat(buyMin), parseFloat(buyMax), parseFloat(buyStep));
    const sellValues = generateRange(parseFloat(sellMin), parseFloat(sellMax), parseFloat(sellStep));
    
    console.log(`Testing ${buyValues.length} buy values × ${sellValues.length} sell values = ${buyValues.length * sellValues.length} combinations per method`);
    
    const results = [];
    const bestPerMethod = {};
    let totalCombinations = 0;
    
    // Process each method
    for (const method of methods) {
      const methodUpper = method.toUpperCase();
      let methodBest = null;
      
      // Test each buy/sell combination
      for (const buyPct of buyValues) {
        for (const sellPct of sellValues) {
          totalCombinations++;
          
          try {
            // Fetch events for this combination
            const events = await fetchEventsForCombination(
              client, symbol, methodUpper, session,
              buyPct, sellPct, startDate, endDate
            );
            
            // Filter to alternating
            const filteredEvents = filterToAlternating(events);
            
            // Simulate wallet
            const walletResult = simulateWallet(filteredEvents, initialCapital);
            
            const result = {
              method: methodUpper,
              buyPct,
              sellPct,
              totalReturn: walletResult.totalReturn,
              totalTrades: walletResult.totalTrades,
              finalEquity: walletResult.finalEquity
            };
            
            results.push(result);
            
            // Track best for this method
            if (!methodBest || result.totalReturn > methodBest.totalReturn) {
              methodBest = result;
            }
          } catch (err) {
            console.error(`Error processing ${methodUpper} ${buyPct}/${sellPct}:`, err.message);
            // Continue with other combinations
          }
        }
      }
      
      // Store best for this method
      if (methodBest) {
        bestPerMethod[methodUpper] = {
          buyPct: methodBest.buyPct,
          sellPct: methodBest.sellPct,
          totalReturn: methodBest.totalReturn,
          totalTrades: methodBest.totalTrades
        };
      }
    }
    
    // Sort results by return (descending)
    results.sort((a, b) => b.totalReturn - a.totalReturn);
    
    const totalTime = Date.now() - startTime;
    console.log(`Grid search completed in ${totalTime}ms, tested ${totalCombinations} combinations`);
    
    res.json({
      success: true,
      symbol,
      session,
      dateRange: { startDate, endDate },
      results,
      bestPerMethod,
      stats: {
        totalCombinations,
        methodsTested: methods.length,
        buyValues: buyValues.length,
        sellValues: sellValues.length
      },
      timing: {
        total: totalTime,
        avgPerCombination: Math.round(totalTime / totalCombinations)
      }
    });
    
  } catch (error) {
    console.error('Error in grid-search:', error);
    res.status(500).json({
      error: 'Failed to perform grid search',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;