import { Router } from 'express';
import pkg from 'pg';
const { Client } = pkg;

const router = Router();

const dbConfig = {
  host: process.env.DB_HOST || '/cloudsql/tradiac-testing:us-central1:tradiac-testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tradiac_testing',
  port: 5432,
};

function getTableName(method) {
  return `trade_events_crypto_${method.toLowerCase()}`;
}

async function fetchEventsForCombination(client, symbol, method, buyPct, sellPct, startDate, endDate) {
  const tableName = getTableName(method);
  
  const query = `
    SELECT 
      TO_CHAR(event_timestamp, 'MM/DD/YYYY HH24:MI:SS') as event_timestamp,
      event_type,
      crypto_price,
      btc_price,
      ratio,
      baseline
    FROM ${tableName}
    WHERE symbol = $1
      AND buy_pct = $2
      AND sell_pct = $3
      AND event_timestamp >= $4::timestamp
      AND event_timestamp <= $5::timestamp
    ORDER BY event_timestamp
  `;
  
  const result = await client.query(query, [symbol, buyPct, sellPct, startDate, endDate]);
  return result.rows;
}

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

function applyConservativeRounding(price, isBuy) {
  if (isBuy) {
    return Math.ceil(price * 100000000) / 100000000; // Round up for buys
  } else {
    return Math.floor(price * 100000000) / 100000000; // Round down for sells
  }
}

function applySlippage(price, slippagePct, isBuy) {
  if (isBuy) {
    return price * (1 + slippagePct / 100);
  } else {
    return price * (1 - slippagePct / 100);
  }
}

function simulateWallet(events, initialCapital = 10000, slippagePct = 0, conservativeRounding = false) {
  let cash = initialCapital;
  let crypto = 0;
  let trades = 0;
  
  for (const event of events) {
    let price = parseFloat(event.crypto_price);
    const isBuy = event.event_type === 'BUY';
    
    if (slippagePct > 0) {
      price = applySlippage(price, slippagePct, isBuy);
    }
    
    if (conservativeRounding) {
      price = applyConservativeRounding(price, isBuy);
    }
    
    if (isBuy && cash > 0) {
      crypto = cash / price;
      cash = 0;
      trades++;
    } else if (!isBuy && crypto > 0) {
      cash = crypto * price;
      crypto = 0;
      trades++;
    }
  }
  
  const finalEquity = cash + (crypto * parseFloat(events[events.length - 1]?.crypto_price || 0));
  const totalReturn = finalEquity - initialCapital;
  const totalReturnPct = (totalReturn / initialCapital) * 100;
  
  return {
    finalEquity,
    totalReturn,
    totalReturnPct,
    totalTrades: trades
  };
}

router.post('/crypto-grid-search', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const {
      symbol,
      methods = ['EQUAL_MEAN'],
      buyMin = 0.5,
      buyMax = 2.0,
      buyStep = 0.5,
      sellMin = 0.5,
      sellMax = 2.0,
      sellStep = 0.5,
      startDate,
      endDate,
      initialCapital = 10000,
      slippage = 0,
      conservativeRounding = false
    } = req.body;
    
    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol, startDate, endDate'
      });
    }
    
    const results = [];
    const bestPerMethod = {};
    
    const startTime = Date.now();
    
    for (const method of methods) {
      let bestForMethod = null;
      
      for (let buy = buyMin; buy <= buyMax; buy += buyStep) {
        for (let sell = sellMin; sell <= sellMax; sell += sellStep) {
          const buyPct = Math.round(buy * 10) / 10;
          const sellPct = Math.round(sell * 10) / 10;
          
          const events = await fetchEventsForCombination(
            client, symbol, method, buyPct, sellPct, startDate, endDate
          );
          
          if (events.length === 0) continue;
          
          const filtered = filterToAlternating(events);
          const simulation = simulateWallet(filtered, initialCapital, slippage, conservativeRounding);
          
          const result = {
            method,
            buyPct,
            sellPct,
            totalReturn: simulation.totalReturn,
            totalReturnPct: simulation.totalReturnPct,
            totalTrades: simulation.totalTrades,
            finalEquity: simulation.finalEquity
          };
          
          results.push(result);
          
          if (!bestForMethod || result.totalReturn > bestForMethod.totalReturn) {
            bestForMethod = result;
          }
        }
      }
      
      if (bestForMethod) {
        bestPerMethod[method] = bestForMethod;
      }
    }
    
    const totalTime = Date.now() - startTime;
    const buyValues = Math.round((buyMax - buyMin) / buyStep) + 1;
    const sellValues = Math.round((sellMax - sellMin) / sellStep) + 1;
    
    res.json({
      success: true,
      symbol,
      results,
      bestPerMethod,
      stats: {
        totalCombinations: results.length,
        methodsTested: methods.length,
        buyValues,
        sellValues
      },
      timing: {
        total: totalTime,
        avgPerCombination: totalTime / results.length
      }
    });
    
  } catch (error) {
    console.error('Grid search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await client.end();
  }
});

export default router;