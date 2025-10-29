// Pattern Best/Worst Per Stock Endpoint
// Shows best AND worst performing strategies for each stock during pattern dates

import fetch from 'node-fetch';

// POST /api/patterns/best-worst-per-stock
// Analyzes best and worst strategies for each stock during pattern matches
export async function bestWorstPerStock(req, res) {
  try {
    const {
      matches,        // array of pattern matches from custom-detect
      offset = 0,     // 0 = during pattern, 1 = day after, 2 = 2 days after, etc.
      minInstances = 3 // minimum pattern instances to include strategy
    } = req.body;

    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid matches array'
      });
    }

    console.log(`Analyzing best/worst per stock for ${matches.length} pattern matches with offset ${offset}`);
    console.log(`minInstances: ${minInstances}`);

    const API_BASE_URL = 'https://tradiac-api-941257247637.us-central1.run.app';
    const allResults = [];

    // Process each match
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      try {
        // Calculate analysis date range based on offset
        let analysisStartDate, analysisEndDate;
        
        if (offset === 0) {
          // During the pattern
          analysisStartDate = match.start_date;
          analysisEndDate = match.end_date;
        } else {
          // After the pattern (offset days)
          const endDate = new Date(match.end_date);
          analysisStartDate = new Date(endDate);
          analysisStartDate.setDate(analysisStartDate.getDate() + offset);
          
          analysisEndDate = new Date(analysisStartDate);
          analysisEndDate.setDate(analysisEndDate.getDate() + 1); // Analyze 1 day
          
          analysisStartDate = analysisStartDate.toISOString().split('T')[0];
          analysisEndDate = analysisEndDate.toISOString().split('T')[0];
        }

        console.log(`  [${i + 1}/${matches.length}] Analyzing ${analysisStartDate} to ${analysisEndDate}`);

        // Call Best Performers API for RTH
        const rthResponse = await fetch(`${API_BASE_URL}/api/events/top-performers-v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: analysisStartDate,
            endDate: analysisEndDate,
            symbol: 'All',
            method: 'All',
            session: 'RTH',
            limit: 500 // Get more to ensure we have all stocks
          })
        });

        const rthResult = await rthResponse.json();

        if (rthResult.success && rthResult.data) {
          rthResult.data.forEach(strategy => {
            allResults.push({
              ...strategy,
              matchStartDate: match.start_date,
              matchEndDate: match.end_date,
              matchChangePct: match.change_pct,
              analysisStartDate,
              analysisEndDate,
              offset
            });
          });
        }

        // Call Best Performers API for AH
        const ahResponse = await fetch(`${API_BASE_URL}/api/events/top-performers-v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: analysisStartDate,
            endDate: analysisEndDate,
            symbol: 'All',
            method: 'All',
            session: 'AH',
            limit: 500 // Get more to ensure we have all stocks
          })
        });

        const ahResult = await ahResponse.json();

        if (ahResult.success && ahResult.data) {
          ahResult.data.forEach(strategy => {
            allResults.push({
              ...strategy,
              matchStartDate: match.start_date,
              matchEndDate: match.end_date,
              matchChangePct: match.change_pct,
              analysisStartDate,
              analysisEndDate,
              offset
            });
          });
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  Error processing match ${i + 1}:`, error.message);
      }
    }

    // Aggregate results by strategy (symbol, method, session, buy_pct, sell_pct)
    const aggregated = {};
    
    console.log(`Total results collected from API calls: ${allResults.length}`);
    
    allResults.forEach(result => {
      const key = `${result.symbol}_${result.method}_${result.session}_${result.buyPct}_${result.sellPct}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          symbol: result.symbol,
          method: result.method,
          session: result.session,
          buyPct: result.buyPct,
          sellPct: result.sellPct,
          instances: 0,
          totalRoi: 0,
          winningInstances: 0,
          totalTrades: 0,
          winningTrades: 0,
          roiValues: []
        };
      }

      aggregated[key].instances++;
      aggregated[key].totalRoi += result.totalRoi || 0;
      aggregated[key].roiValues.push(result.totalRoi || 0);
      
      if (result.totalRoi > 0) {
        aggregated[key].winningInstances++;
      }
      
      aggregated[key].totalTrades += result.totalTrades || 0;
      aggregated[key].winningTrades += result.winningTrades || 0;
    });

    // Calculate final metrics for all strategies (don't filter by minInstances yet)
    console.log(`Unique strategies aggregated: ${Object.keys(aggregated).length}`);
    
    const allStrategies = Object.values(aggregated)
      .map(strategy => ({
        symbol: strategy.symbol,
        method: strategy.method,
        session: strategy.session,
        buyPct: strategy.buyPct,
        sellPct: strategy.sellPct,
        instances: strategy.instances,
        avgRoi: strategy.totalRoi / strategy.instances,
        consistency: (strategy.winningInstances / strategy.instances) * 100,
        totalTrades: strategy.totalTrades,
        avgWinRate: strategy.totalTrades > 0 
          ? (strategy.winningTrades / strategy.totalTrades) * 100 
          : 0,
        minRoi: Math.min(...strategy.roiValues),
        maxRoi: Math.max(...strategy.roiValues)
      }));

    // Group by stock and session, find best and worst for each
    const stockSessions = {};
    
    console.log(`Total strategies before grouping: ${allStrategies.length}`);
    
    allStrategies.forEach(strategy => {
      const key = `${strategy.symbol}_${strategy.session}`;
      
      if (!stockSessions[key]) {
        stockSessions[key] = {
          symbol: strategy.symbol,
          session: strategy.session,
          strategies: []
        };
      }
      
      stockSessions[key].strategies.push(strategy);
    });

    // Find best and worst for each stock+session
    const results = [];
    
    console.log(`Stock+Session groups: ${Object.keys(stockSessions).length}`);
    
    Object.values(stockSessions).forEach(group => {
      console.log(`Processing ${group.symbol} ${group.session}: ${group.strategies.length} strategies`);
      
      // Filter strategies that meet minInstances requirement
      let validStrategies = group.strategies.filter(s => s.instances >= minInstances);
      
      console.log(`  After minInstances filter (>=${minInstances}): ${validStrategies.length} strategies`);
      
      if (validStrategies.length === 0) {
        // If no strategies meet minInstances, just use all strategies for this stock+session
        console.log(`  No strategies meet minInstances, using all ${group.strategies.length} strategies`);
        validStrategies = [...group.strategies];
      }
      
      // Sort by avgRoi
      const sorted = validStrategies.sort((a, b) => b.avgRoi - a.avgRoi);
      
      if (sorted.length > 0) {
        // Best strategy
        results.push({
          ...sorted[0],
          category: 'BEST'
        });
        
        // Worst strategy (if we have more than one)
        if (sorted.length > 1) {
          results.push({
            ...sorted[sorted.length - 1],
            category: 'WORST'
          });
        }
      }
    });

    // Sort results: by symbol, then session (RTH first), then category (BEST first)
    results.sort((a, b) => {
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      if (a.session !== b.session) return a.session === 'RTH' ? -1 : 1;
      return a.category === 'BEST' ? -1 : 1;
    });

    console.log(`Found ${results.length} best/worst strategies across ${Object.keys(stockSessions).length} stock+session combinations`);

    res.json({
      success: true,
      offset,
      matchesAnalyzed: matches.length,
      minInstances,
      totalResults: results.length,
      data: results
    });

  } catch (error) {
    console.error('Error in bestWorstPerStock:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  bestWorstPerStock
};