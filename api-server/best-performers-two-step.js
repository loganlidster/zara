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

// Step 1: Get top candidates by sum of trade ROI (fast SQL aggregation)
async function getTopCandidates(client, startDate, endDate, symbol, method, session, candidateLimit = 100) {
  const sessions = session ? [session.toUpperCase()] : ['RTH', 'AH'];
  const methods = method ? [method.toUpperCase()] : ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
  
  const queryPromises = [];
  
  for (const sess of sessions) {
    for (const meth of methods) {
      const tableName = getTableName(sess, meth);
      
      const query = `
        SELECT 
          '${sess}' as session,
          '${meth}' as method,
          symbol,
          buy_pct,
          sell_pct,
          COALESCE(SUM(trade_roi_pct), 0) as score,
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE trade_roi_pct IS NOT NULL) as sell_events
        FROM ${tableName}
        WHERE event_date >= $1
          AND event_date <= $2
          ${symbol ? 'AND symbol = $3' : ''}
        GROUP BY symbol, buy_pct, sell_pct
        HAVING COUNT(*) > 0
        ORDER BY score DESC
        LIMIT ${candidateLimit}
      `;
      
      const params = symbol ? [startDate, endDate, symbol] : [startDate, endDate];
      
      queryPromises.push(
        client.query(query, params)
          .then(result => result.rows)
          .catch(err => {
            console.error(`Error querying ${tableName}:`, err.message);
            return [];
          })
      );
    }
  }
  
  const allResults = await Promise.all(queryPromises);
  const candidates = allResults.flat();
  
  // Sort by score and return top candidates
  candidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
  return candidates.slice(0, candidateLimit);
}

// Step 2: Fetch events for a specific combination
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
router.get('/top-performers-v2', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    const { startDate, endDate, limit = 20, symbols, method, session, viewMode = 'overall' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['startDate', 'endDate']
      });
    }
    
    // Parse symbols - can be comma-separated string or array
    let symbolList = null;
    if (symbols) {
      symbolList = Array.isArray(symbols) ? symbols : symbols.split(',');
    }
    
    const requestedLimit = parseInt(limit);
    const candidateLimit = Math.max(100, requestedLimit * 5); // Get 5x more candidates than requested
    
    console.log(`Step 1: Finding top ${candidateLimit} candidates by score...`);
    console.log(`Symbols: ${symbolList ? symbolList.join(', ') : 'All'}, ViewMode: ${viewMode}`);
    const step1Start = Date.now();
    
    // Step 1: Get top candidates by sum (fast)
    // If multiple symbols, we need to handle them differently based on viewMode
    let candidates;
    if (symbolList && symbolList.length > 0 && viewMode === 'per-stock') {
      // Per-stock mode: get top candidates for each symbol separately
      const allCandidates = [];
      for (const sym of symbolList) {
        const symCandidates = await getTopCandidates(
          client, startDate, endDate, sym, method, session, candidateLimit
        );
        allCandidates.push(...symCandidates);
      }
      candidates = allCandidates;
    } else if (symbolList && symbolList.length > 0) {
      // Overall mode with specific symbols: get candidates for all symbols combined
      const allCandidates = [];
      for (const sym of symbolList) {
        const symCandidates = await getTopCandidates(
          client, startDate, endDate, sym, method, session, candidateLimit
        );
        allCandidates.push(...symCandidates);
      }
      // Sort all candidates by score and take top N
      allCandidates.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
      candidates = allCandidates.slice(0, candidateLimit);
    } else {
      // No specific symbols - get all
      candidates = await getTopCandidates(
        client, startDate, endDate, null, method, session, candidateLimit
      );
    }
    
    const step1Time = Date.now() - step1Start;
    console.log(`Step 1 completed in ${step1Time}ms, found ${candidates.length} candidates`);
    
    if (candidates.length === 0) {
      return res.json({
        success: true,
        dateRange: { startDate, endDate },
        count: 0,
        topPerformers: [],
        timing: { step1: step1Time, step2: 0, total: step1Time }
      });
    }
    
    console.log(`Step 2: Simulating wallet for top ${candidates.length} candidates...`);
    const step2Start = Date.now();
    
    // Step 2: Simulate wallet for each candidate (accurate)
    const withTrueROI = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const events = await fetchEventsForCombination(
            client,
            candidate.symbol,
            candidate.method,
            candidate.session,
            parseFloat(candidate.buy_pct),
            parseFloat(candidate.sell_pct),
            startDate,
            endDate
          );
          
          const filteredEvents = filterToAlternating(events);
          const walletResult = simulateWallet(filteredEvents, 10000);
          
          return {
            symbol: candidate.symbol,
            method: candidate.method,
            session: candidate.session,
            buyPct: parseFloat(candidate.buy_pct),
            sellPct: parseFloat(candidate.sell_pct),
            roiPct: walletResult.portfolioROI,
            totalEvents: parseInt(candidate.total_events),
            sellEvents: parseInt(candidate.sell_events),
            totalTrades: walletResult.totalTrades,
            finalEquity: walletResult.finalEquity,
            endingShares: walletResult.endingShares,
            endingCash: walletResult.endingCash,
            sumScore: parseFloat(candidate.score) // Keep original score for reference
          };
        } catch (err) {
          console.error(`Error simulating ${candidate.symbol}:`, err.message);
          return null;
        }
      })
    );
    
    const step2Time = Date.now() - step2Start;
    console.log(`Step 2 completed in ${step2Time}ms`);
    
    // Filter out nulls and sort by true ROI
    const validResults = withTrueROI.filter(r => r !== null);
    validResults.sort((a, b) => b.roiPct - a.roiPct);
    
    // Return top N
    const topPerformers = validResults.slice(0, requestedLimit);
    
    const totalTime = step1Time + step2Time;
    console.log(`Total time: ${totalTime}ms, returning top ${topPerformers.length} performers`);
    
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      count: topPerformers.length,
      topPerformers: topPerformers,
      timing: {
        step1: step1Time,
        step2: step2Time,
        total: totalTime,
        candidatesEvaluated: candidates.length
      }
    });
    
  } catch (error) {
    console.error('Error in top-performers-v2:', error);
    res.status(500).json({
      error: 'Failed to get top performers',
      message: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;