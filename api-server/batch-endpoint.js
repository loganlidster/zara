import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || '34.41.97.179',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradiac_testing',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

export async function batchSimulate(req, res) {
  try {
    const {
      symbols,
      methods,
      buyPctMin,
      buyPctMax,
      sellPctMin,
      sellPctMax,
      startDate,
      endDate,
      session = 'RTH',
      initialCapital = 10000,
      allowShorts = false,
      conservativePricing = true,
      slippage = 0
    } = req.body;

    console.log('🔥 Starting batch grid search:', {
      symbols: symbols.length,
      methods: methods.length,
      buyRange: `${buyPctMin}-${buyPctMax}%`,
      sellRange: `${sellPctMin}-${sellPctMax}%`
    });

    // Generate all combinations
    const buyPcts = [];
    for (let pct = buyPctMin; pct <= buyPctMax; pct += 0.1) {
      buyPcts.push(Math.round(pct * 10) / 10);
    }
    
    const sellPcts = [];
    for (let pct = sellPctMin; pct <= sellPctMax; pct += 0.1) {
      sellPcts.push(Math.round(pct * 10) / 10);
    }

    const totalCombinations = symbols.length * methods.length * buyPcts.length * sellPcts.length;
    console.log(`📊 Total combinations: ${totalCombinations}`);

    const results = [];
    let completed = 0;

    // Process each combination
    for (const symbol of symbols) {
      for (const method of methods) {
        for (const buyPct of buyPcts) {
          for (const sellPct of sellPcts) {
            try {
              const client = new Client(dbConfig);
              await client.connect();

              const query = `
                SELECT 
                  s.et_date,
                  s.et_time,
                  s.close as stock_close,
                  b.close as btc_close,
                  bl.baseline,
                  s.session,
                  tc.prev_open_date,
                  (b.close / NULLIF(s.close, 0)) as current_ratio
                FROM minute_stock s
                INNER JOIN minute_btc b ON s.bar_time = b.bar_time
                INNER JOIN trading_calendar tc ON s.et_date = tc.cal_date
                INNER JOIN baseline_daily bl ON 
                  bl.symbol = s.symbol 
                  AND bl.trading_day = tc.prev_open_date
                  AND bl.session = s.session
                  AND bl.method = $1
                WHERE s.symbol = $2
                  AND s.et_date >= $3
                  AND s.et_date <= $4
                  AND s.session = $5
                  AND tc.is_open = true
                ORDER BY s.bar_time ASC
              `;

              const result = await client.query(query, [method, symbol, startDate, endDate, session]);
              await client.end();

              if (result.rows.length === 0) {
                completed++;
                continue;
              }

              // Run simulation
              let cash = initialCapital;
              let shares = 0;
              let position = 'FLAT';
              let totalTrades = 0;

              for (const bar of result.rows) {
                const { stock_close, baseline, current_ratio } = bar;
                
                const buyThreshold = baseline * (1 + buyPct / 100);
                const sellThreshold = baseline * (1 - sellPct / 100);

                if (position === 'FLAT' && current_ratio > buyThreshold) {
                  const sharesToBuy = Math.floor(cash / stock_close);
                  if (sharesToBuy > 0) {
                    let buyPrice = stock_close;
                    if (conservativePricing) {
                      buyPrice = buyPrice * (1 + slippage / 100);
                      buyPrice = Math.ceil(buyPrice * 100) / 100;
                    }
                    const cost = sharesToBuy * buyPrice;
                    if (cost <= cash) {
                      shares = sharesToBuy;
                      cash -= cost;
                      position = 'LONG';
                    }
                  }
                } else if (position === 'LONG' && current_ratio < sellThreshold) {
                  let sellPrice = stock_close;
                  if (conservativePricing) {
                    sellPrice = sellPrice * (1 - slippage / 100);
                    sellPrice = Math.floor(sellPrice * 100) / 100;
                  }
                  const proceeds = shares * sellPrice;
                  cash += proceeds;
                  shares = 0;
                  position = 'FLAT';
                  totalTrades++;
                }
              }

              // Close any open position
              if (shares !== 0) {
                const lastBar = result.rows[result.rows.length - 1];
                cash += shares * lastBar.stock_close;
                shares = 0;
              }

              const finalEquity = cash;
              const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

              results.push({
                symbol,
                method,
                buyPct,
                sellPct,
                totalReturn: parseFloat(totalReturn.toFixed(2)),
                finalEquity: parseFloat(finalEquity.toFixed(2)),
                totalTrades
              });

              completed++;
              
              // Log progress every 10%
              if (completed % Math.ceil(totalCombinations / 10) === 0) {
                console.log(`📈 Progress: ${completed}/${totalCombinations} (${Math.round(completed/totalCombinations*100)}%)`);
              }

            } catch (error) {
              console.error(`❌ Error for ${symbol} ${method} ${buyPct}/${sellPct}:`, error.message);
              completed++;
            }
          }
        }
      }
    }

    // Sort results by total return
    results.sort((a, b) => b.totalReturn - a.totalReturn);

    console.log(`✅ Batch complete: ${results.length} successful simulations`);

    res.json({
      totalCombinations,
      successfulSimulations: results.length,
      results: results, // Return all results
      topResult: results[0],
      summary: {
        bestReturn: results[0]?.totalReturn || 0,
        worstReturn: results[results.length - 1]?.totalReturn || 0,
        avgReturn: results.length > 0 ? parseFloat((results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length).toFixed(2)) : 0
      }
    });

  } catch (error) {
    console.error('❌ Batch simulation error:', error);
    res.status(500).json({ error: error.message });
  }
}