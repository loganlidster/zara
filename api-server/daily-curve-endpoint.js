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

// Fetch events for a symbol
async function fetchEventsForSymbol(client, symbol, method, session, buyPct, sellPct, startDate, endDate) {
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

// Simulate wallet and calculate daily cumulative ROI
function simulateDailyCurve(events, initialCapital = 10000) {
  if (events.length === 0) {
    return { dailyData: [], metrics: null };
  }
  
  let cash = initialCapital;
  let shares = 0;
  let totalTrades = 0;
  const dailyData = [];
  const equityHistory = [];
  
  // Group events by date
  const eventsByDate = {};
  for (const event of events) {
    const dateStr = new Date(event.event_date).toISOString().split('T')[0];
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = [];
    }
    eventsByDate[dateStr].push(event);
  }
  
  // Sort dates
  const dates = Object.keys(eventsByDate).sort();
  
  // Process each day
  for (const date of dates) {
    const dayEvents = eventsByDate[date];
    
    // Get price at start of day (first event's price)
    const startPrice = parseFloat(dayEvents[0].stock_price);
    const startEquity = cash + (shares * startPrice);
    
    // Process events for this day
    for (const event of dayEvents) {
      const price = parseFloat(event.stock_price);
      
      if (event.event_type === 'BUY' && shares === 0) {
        const sharesToBuy = Math.floor(cash / price);
        if (sharesToBuy > 0) {
          shares = sharesToBuy;
          cash -= sharesToBuy * price;
          totalTrades++;
        }
      } else if (event.event_type === 'SELL' && shares > 0) {
        cash += shares * price;
        shares = 0;
        totalTrades++;
      }
    }
    
    // Get price at end of day (last event's price)
    const endPrice = parseFloat(dayEvents[dayEvents.length - 1].stock_price);
    const endEquity = cash + (shares * endPrice);
    const cumulativeROI = ((endEquity - initialCapital) / initialCapital) * 100;
    
    dailyData.push({
      date: date,
      equity: endEquity,
      roi: cumulativeROI
    });
    
    equityHistory.push(endEquity);
  }
  
  // Calculate max drawdown
  let maxDrawdown = 0;
  let runningMax = equityHistory[0] || initialCapital;
  
  for (const equity of equityHistory) {
    runningMax = Math.max(runningMax, equity);
    const drawdown = ((equity - runningMax) / runningMax) * 100;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
  }
  
  const finalEquity = equityHistory[equityHistory.length - 1] || initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  
  return {
    dailyData,
    metrics: {
      totalReturn,
      totalTrades,
      maxDrawdown,
      finalEquity
    }
  };
}

// Calculate BTC benchmark
function calculateBtcBenchmark(allEvents, alignedDates) {
  if (allEvents.length === 0 || alignedDates.length === 0) {
    return alignedDates.map(() => null);
  }
  
  // Get BTC price on first date
  const firstDate = alignedDates[0];
  const firstEvent = allEvents.find(e => {
    const eventDate = new Date(e.event_date).toISOString().split('T')[0];
    return eventDate === firstDate;
  });
  
  if (!firstEvent) {
    return alignedDates.map(() => null);
  }
  
  const firstPrice = parseFloat(firstEvent.btc_price);
  
  // Calculate return for each date
  return alignedDates.map(date => {
    const event = allEvents.find(e => {
      const eventDate = new Date(e.event_date).toISOString().split('T')[0];
      return eventDate === date;
    });
    
    if (!event) return null;
    
    const currentPrice = parseFloat(event.btc_price);
    return ((currentPrice - firstPrice) / firstPrice) * 100;
  });
}

// Main endpoint
router.post('/daily-curve', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbols,
      method,
      session,
      buyPct,
      sellPct,
      startDate,
      endDate,
      alignmentMode = 'union',
      includeBtc = true
    } = req.body;
    
    // Validate inputs
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid symbols array'
      });
    }
    
    if (!method || !session || buyPct === undefined || sellPct === undefined || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbols', 'method', 'session', 'buyPct', 'sellPct', 'startDate', 'endDate']
      });
    }
    
    console.log(`Processing daily curve for ${symbols.length} symbols...`);
    const startTime = Date.now();
    
    // Process each symbol
    const symbolResults = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Fetch events
          const events = await fetchEventsForSymbol(
            client, symbol, method, session,
            parseFloat(buyPct), parseFloat(sellPct),
            startDate, endDate
          );
          
          // Filter to alternating
          const filteredEvents = filterToAlternating(events);
          
          // Simulate wallet
          const { dailyData, metrics } = simulateDailyCurve(filteredEvents, 10000);
          
          return {
            symbol,
            dailyData,
            metrics,
            allEvents: events // Keep for BTC calculation
          };
        } catch (err) {
          console.error(`Error processing ${symbol}:`, err.message);
          return {
            symbol,
            dailyData: [],
            metrics: null,
            allEvents: [],
            error: err.message
          };
        }
      })
    );
    
    // Collect all dates from all symbols
    const allDates = new Set();
    for (const result of symbolResults) {
      for (const day of result.dailyData) {
        allDates.add(day.date);
      }
    }
    
    // Align dates based on mode
    let alignedDates;
    if (alignmentMode === 'intersection') {
      // Only include dates where ALL symbols have data
      const symbolDateSets = symbolResults.map(r => 
        new Set(r.dailyData.map(d => d.date))
      );
      
      alignedDates = Array.from(allDates).filter(date =>
        symbolDateSets.every(dateSet => dateSet.has(date))
      ).sort();
    } else {
      // Union: include any date where ANY symbol has data
      alignedDates = Array.from(allDates).sort();
    }
    
    // Build series data
    const series = {};
    const metrics = [];
    
    for (const result of symbolResults) {
      const { symbol, dailyData, metrics: symbolMetrics } = result;
      
      // Create date-to-ROI map
      const roiMap = {};
      for (const day of dailyData) {
        roiMap[day.date] = day.roi;
      }
      
      // Map to aligned dates
      series[symbol] = alignedDates.map(date => roiMap[date] || null);
      
      // Add metrics
      if (symbolMetrics) {
        metrics.push({
          symbol,
          ...symbolMetrics
        });
      }
    }
    
    // Add BTC benchmark if requested
    if (includeBtc && symbolResults.length > 0) {
      // Use events from first symbol for BTC prices
      const allEvents = symbolResults[0].allEvents;
      const btcReturns = calculateBtcBenchmark(allEvents, alignedDates);
      series['BTC'] = btcReturns;
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Daily curve completed in ${totalTime}ms`);
    
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      data: {
        dates: alignedDates,
        series
      },
      metrics,
      timing: {
        total: totalTime,
        symbolsProcessed: symbols.length
      }
    });
    
  } catch (error) {
    console.error('Error in daily-curve:', error);
    res.status(500).json({
      error: 'Failed to generate daily curve',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;