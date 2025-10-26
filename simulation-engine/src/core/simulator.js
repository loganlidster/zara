const { Client } = require('pg');

class Simulator {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
  }

  async runSimulation(params) {
    const {
      symbol,
      startDate,
      endDate,
      method,
      buyPct,
      sellPct,
      session = 'RTH',
      initialCapital = 10000
    } = params;

    const client = new Client(this.dbConfig);
    await client.connect();

    try {
      console.log(`\n🎯 Running simulation for ${symbol}`);
      console.log(`   Method: ${method}, Buy: ${buyPct}%, Sell: ${sellPct}%`);
      console.log(`   Period: ${startDate} to ${endDate}`);
      console.log(`   Session: ${session}, Capital: $${initialCapital}`);

      // CRITICAL FIX: Use prev_open_date from trading_calendar for baseline lookup
      const query = `
        SELECT 
          s.et_date,
          s.et_time,
          s.bar_time,
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
      
      if (result.rows.length === 0) {
        console.log('⚠️  No data found for this simulation');
        return null;
      }

      console.log(`   Found ${result.rows.length} bars to process`);

      // Initialize simulation state
      let cash = initialCapital;
      let shares = 0;
      let position = 'FLAT'; // FLAT, LONG, SHORT
      let trades = [];
      let dailyPerformance = [];
      let currentDay = null;
      let dayStartEquity = initialCapital;
      let dayTrades = 0;

      // Process each bar
      for (const bar of result.rows) {
        const { et_date, et_time, stock_close, btc_close, baseline, current_ratio, prev_open_date } = bar;

        // Calculate thresholds based on PREVIOUS day's baseline
        const buyThreshold = baseline * (1 + buyPct / 100);
        const sellThreshold = baseline * (1 - sellPct / 100);

        // Track daily performance
        if (currentDay !== et_date) {
          if (currentDay !== null) {
            // Save previous day's performance
            const dayEndEquity = cash + (shares * stock_close);
            const dayReturn = ((dayEndEquity - dayStartEquity) / dayStartEquity) * 100;
            
            dailyPerformance.push({
              date: currentDay,
              start_equity: dayStartEquity,
              end_equity: dayEndEquity,
              return_pct: dayReturn,
              trades: dayTrades
            });
          }
          
          currentDay = et_date;
          dayStartEquity = cash + (shares * stock_close);
          dayTrades = 0;
        }

        // Trading logic
        if (position === 'FLAT') {
          // Check for entry signals
          if (current_ratio > buyThreshold) {
            // BUY signal - stock is cheap relative to BTC
            const sharesToBuy = Math.floor(cash / stock_close);
            if (sharesToBuy > 0) {
              // Conservative pricing: round UP for buys
              const buyPrice = Math.ceil(stock_close * 100) / 100;
              const cost = sharesToBuy * buyPrice;
              
              if (cost <= cash) {
                shares = sharesToBuy;
                cash -= cost;
                position = 'LONG';
                
                trades.push({
                  date: et_date,
                  time: et_time,
                  action: 'BUY',
                  shares: sharesToBuy,
                  price: buyPrice,
                  value: cost,
                  baseline: baseline,
                  prev_baseline_date: prev_open_date,
                  current_ratio: current_ratio,
                  buy_threshold: buyThreshold
                });
                
                dayTrades++;
              }
            }
          } else if (current_ratio < sellThreshold) {
            // SHORT signal - stock is expensive relative to BTC
            const sharesToShort = Math.floor(cash / stock_close);
            if (sharesToShort > 0) {
              // Conservative pricing: round DOWN for shorts
              const shortPrice = Math.floor(stock_close * 100) / 100;
              const proceeds = sharesToShort * shortPrice;
              
              shares = -sharesToShort;
              cash += proceeds;
              position = 'SHORT';
              
              trades.push({
                date: et_date,
                time: et_time,
                action: 'SHORT',
                shares: sharesToShort,
                price: shortPrice,
                value: proceeds,
                baseline: baseline,
                prev_baseline_date: prev_open_date,
                current_ratio: current_ratio,
                sell_threshold: sellThreshold
              });
              
              dayTrades++;
            }
          }
        } else if (position === 'LONG') {
          // Check for exit signal (ratio drops below sell threshold)
          if (current_ratio < sellThreshold) {
            // Conservative pricing: round DOWN for sells
            const sellPrice = Math.floor(stock_close * 100) / 100;
            const proceeds = shares * sellPrice;
            
            trades.push({
              date: et_date,
              time: et_time,
              action: 'SELL',
              shares: shares,
              price: sellPrice,
              value: proceeds,
              baseline: baseline,
              prev_baseline_date: prev_open_date,
              current_ratio: current_ratio,
              sell_threshold: sellThreshold
            });
            
            cash += proceeds;
            shares = 0;
            position = 'FLAT';
            dayTrades++;
          }
        } else if (position === 'SHORT') {
          // Check for exit signal (ratio rises above buy threshold)
          if (current_ratio > buyThreshold) {
            // Conservative pricing: round UP for covering shorts
            const coverPrice = Math.ceil(stock_close * 100) / 100;
            const cost = Math.abs(shares) * coverPrice;
            
            trades.push({
              date: et_date,
              time: et_time,
              action: 'COVER',
              shares: Math.abs(shares),
              price: coverPrice,
              value: cost,
              baseline: baseline,
              prev_baseline_date: prev_open_date,
              current_ratio: current_ratio,
              buy_threshold: buyThreshold
            });
            
            cash -= cost;
            shares = 0;
            position = 'FLAT';
            dayTrades++;
          }
        }
      }

      // Close any open position at end
      const lastBar = result.rows[result.rows.length - 1];
      if (shares !== 0) {
        const closePrice = shares > 0 
          ? Math.floor(lastBar.stock_close * 100) / 100  // Sell: round down
          : Math.ceil(lastBar.stock_close * 100) / 100;   // Cover: round up
        
        const value = Math.abs(shares) * closePrice;
        
        trades.push({
          date: lastBar.et_date,
          time: lastBar.et_time,
          action: shares > 0 ? 'SELL' : 'COVER',
          shares: Math.abs(shares),
          price: closePrice,
          value: value,
          baseline: lastBar.baseline,
          prev_baseline_date: lastBar.prev_open_date,
          current_ratio: lastBar.current_ratio,
          note: 'End of period close'
        });
        
        if (shares > 0) {
          cash += value;
        } else {
          cash -= value;
        }
        shares = 0;
      }

      // Final day performance
      if (currentDay !== null) {
        const dayEndEquity = cash;
        const dayReturn = ((dayEndEquity - dayStartEquity) / dayStartEquity) * 100;
        
        dailyPerformance.push({
          date: currentDay,
          start_equity: dayStartEquity,
          end_equity: dayEndEquity,
          return_pct: dayReturn,
          trades: dayTrades
        });
      }

      // Calculate performance metrics
      const finalEquity = cash;
      const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
      const winningTrades = trades.filter((t, i) => {
        if (i === 0) return false;
        const prevTrade = trades[i - 1];
        if (t.action === 'SELL' && prevTrade.action === 'BUY') {
          return t.price > prevTrade.price;
        }
        if (t.action === 'COVER' && prevTrade.action === 'SHORT') {
          return t.price < prevTrade.price;
        }
        return false;
      }).length;

      const totalCompletedTrades = Math.floor(trades.length / 2);
      const winRate = totalCompletedTrades > 0 ? (winningTrades / totalCompletedTrades) * 100 : 0;

      const results = {
        symbol,
        method,
        buyPct,
        sellPct,
        session,
        startDate,
        endDate,
        initialCapital,
        finalEquity,
        totalReturn,
        trades: trades.length,
        completedTrades: totalCompletedTrades,
        winningTrades,
        winRate,
        tradeLog: trades,
        dailyPerformance
      };

      console.log(`\n📊 Results:`);
      console.log(`   Final Equity: $${finalEquity.toFixed(2)}`);
      console.log(`   Total Return: ${totalReturn.toFixed(2)}%`);
      console.log(`   Trades: ${trades.length} (${totalCompletedTrades} completed)`);
      console.log(`   Win Rate: ${winRate.toFixed(2)}%`);

      return results;

    } finally {
      await client.end();
    }
  }
}

module.exports = Simulator;