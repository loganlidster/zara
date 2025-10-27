/**
 * Process Single Group
 * 
 * Processes a single symbol/method/session combination
 * Used by parallel processor
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

const INITIAL_CASH = 10000;

// Generate all buy/sell percentage combinations
function generateCombinations() {
  const combinations = [];
  for (let buy = 0.1; buy <= 3.0; buy += 0.1) {
    for (let sell = 0.1; sell <= 3.0; sell += 0.1) {
      combinations.push({
        buy_pct: Math.round(buy * 10) / 10,
        sell_pct: Math.round(sell * 10) / 10
      });
    }
  }
  return combinations;
}

const COMBINATIONS = generateCombinations();

async function fetchMinuteData(symbol, method, session, startDate, endDate) {
  const client = await pool.connect();
  try {
    // No session filter - process all hours (04:00 - 20:00)
    const sessionFilter = '';

    const query = `
      SELECT 
        ms.bar_time as timestamp,
        ms.close as stock_price,
        mb.close as btc_price,
        mb.close / ms.close as ratio,
        bd.baseline,
        CASE WHEN ms.session = 'RTH' THEN true ELSE false END as is_rth
      FROM minute_stock ms
      JOIN minute_btc mb ON ms.bar_time = mb.bar_time
      JOIN baseline_daily bd ON 
        bd.symbol = ms.symbol 
        AND bd.method = $2
        AND bd.session = ms.session
        AND bd.trading_day = (
          SELECT prev_open_date 
          FROM trading_calendar 
          WHERE cal_date = ms.et_date
        )
      WHERE ms.symbol = $1
        AND ms.et_date BETWEEN $3 AND $4
        ${sessionFilter}
      ORDER BY ms.bar_time
    `;

    const result = await client.query(query, [symbol, method, startDate, endDate]);
    return result.rows;
  } finally {
    client.release();
  }
}

function simulateContinuous(minuteData, buyPct, sellPct) {
  const events = [];
  let cash = INITIAL_CASH;
  let shares = 0;

  for (const bar of minuteData) {
    const { timestamp, stock_price, btc_price, ratio, baseline } = bar;
    
    const buyThreshold = baseline * (1 + buyPct / 100);
    const sellThreshold = baseline * (1 - sellPct / 100);

    if (shares === 0 && ratio >= buyThreshold && cash > 0) {
      const sharesToBuy = Math.floor(cash / stock_price);
      if (sharesToBuy > 0) {
        const transactionValue = sharesToBuy * stock_price;
        cash -= transactionValue;
        shares = sharesToBuy;

        const eventDate = new Date(timestamp);
        const eventTime = eventDate.toTimeString().slice(0, 8); // HH:MM:SS
        const eventDateOnly = eventDate.toISOString().slice(0, 10); // YYYY-MM-DD
        
        // Determine session based on time
        const hour = eventDate.getHours();
        const minute = eventDate.getMinutes();
        const timeInMinutes = hour * 60 + minute;
        const session = (timeInMinutes >= 570 && timeInMinutes < 960) ? 'RTH' : 'AH'; // 9:30 = 570, 16:00 = 960
        
        events.push({
          event_date: eventDateOnly,
          event_time: eventTime,
          session: session,
          event_type: 'BUY',
          stock_price: Math.round(stock_price * 10000) / 10000,
          btc_price: Math.round(btc_price * 100) / 100,
          ratio: Math.round(ratio * 10000) / 10000,
          baseline: baseline
        });
      }
    }
    else if (shares > 0 && ratio <= sellThreshold) {
      const transactionValue = shares * stock_price;
      cash += transactionValue;
      const soldShares = shares;
      shares = 0;

      const sellEventDate = new Date(timestamp);
      const sellEventTime = sellEventDate.toTimeString().slice(0, 8);
      const sellEventDateOnly = sellEventDate.toISOString().slice(0, 10);
      
      const sellHour = sellEventDate.getHours();
      const sellMinute = sellEventDate.getMinutes();
      const sellTimeInMinutes = sellHour * 60 + sellMinute;
      const sellSession = (sellTimeInMinutes >= 570 &amp;&amp; sellTimeInMinutes < 960) ? 'RTH' : 'AH';
      
      const lastBuyPrice = events.length > 0 ? events[events.length - 1].stock_price : stock_price;
      const tradeRoi = ((stock_price - lastBuyPrice) / lastBuyPrice) * 100;
      
      events.push({
        event_date: sellEventDateOnly,
        event_time: sellEventTime,
        session: sellSession,
        event_type: 'SELL',
        stock_price: Math.round(stock_price * 10000) / 10000,
        btc_price: Math.round(btc_price * 100) / 100,
        ratio: Math.round(ratio * 10000) / 10000,
        baseline: baseline,
        trade_roi_pct: Math.round(tradeRoi * 100) / 100
      });
    }
  }

  return events;
}

async function insertEvents(symbol, method, session, buyPct, sellPct, events) {
  if (events.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO trade_events (
        symbol, method, session, buy_pct, sell_pct,
        event_date, event_time, event_type, 
        stock_price, btc_price, ratio, baseline, trade_roi_pct
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (symbol, method, session, buy_pct, sell_pct, event_date, event_time) 
      DO NOTHING
    `;

    for (const event of events) {
      await client.query(insertQuery, [
        symbol, method, event.session, buyPct, sellPct,
        event.event_date, event.event_time, event.event_type,
        event.stock_price, event.btc_price, event.ratio, event.baseline,
        event.trade_roi_pct || null
      ]);
    }

    const buyCount = events.filter(e => e.event_type === 'BUY').length;
    const sellCount = events.filter(e => e.event_type === 'SELL').length;
    const sellEvents = events.filter(e => e.event_type === 'SELL' && e.trade_roi_pct !== null);
    const avgTradeRoi = sellEvents.length > 0 
      ? sellEvents.reduce((sum, e) => sum + e.trade_roi_pct, 0) / sellEvents.length 
      : 0;
    const winRate = sellEvents.length > 0
      ? (sellEvents.filter(e => e.trade_roi_pct > 0).length / sellEvents.length) * 100
      : 0;

    const metadataQuery = `
      INSERT INTO simulation_metadata (
        symbol, method, session, buy_pct, sell_pct,
        status, first_event_date, last_event_date,
        total_events, total_buys, total_sells, 
        avg_trade_roi_pct, win_rate_pct,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (symbol, method, session, buy_pct, sell_pct)
      DO UPDATE SET
        status = $6,
        last_event_date = $8,
        total_events = simulation_metadata.total_events + $9,
        total_buys = simulation_metadata.total_buys + $10,
        total_sells = simulation_metadata.total_sells + $11,
        avg_trade_roi_pct = $12,
        win_rate_pct = $13,
        updated_at = NOW()
    `;

    await client.query(metadataQuery, [
      symbol, method, 'ALL', buyPct, sellPct,
      'completed',
      events[0].event_date,
      events[events.length - 1].event_date,
      events.length,
      buyCount,
      sellCount,
      avgTradeRoi,
      winRate
    ]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function processGroup(symbol, method, session, startDate, endDate) {
  try {
    console.log(`Starting: ${symbol} - ${method} - ${session}`);
    console.log(`Fetching minute data...`);
    
    const minuteData = await fetchMinuteData(symbol, method, session, startDate, endDate);
    console.log(`Fetched ${minuteData.length} minute bars`);
    
    if (minuteData.length === 0) {
      console.log('No data available');
      return;
    }

    let totalEvents = 0;
    let processed = 0;

    for (const combo of COMBINATIONS) {
      const { buy_pct, sell_pct } = combo;
      const events = simulateContinuous(minuteData, buy_pct, sell_pct);

      if (events.length > 0) {
        await insertEvents(symbol, method, session, buy_pct, sell_pct, events);
        totalEvents += events.length;
      }
      
      processed++;
      if (processed % 50 === 0 || processed === 1) {
        console.log(`Processed ${processed}/${COMBINATIONS.length} combinations (${totalEvents} events so far)`);
      }
    }

    console.log(`COMPLETE: Processed ${COMBINATIONS.length} combinations, ${totalEvents} events`);
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    console.error(error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

// Get command line args
const [symbol, method, session, startDate, endDate] = process.argv.slice(2);

if (!symbol || !method || !session || !startDate || !endDate) {
  console.error('Usage: node process-single-group.js <symbol> <method> <session> <start_date> <end_date>');
  process.exit(1);
}

processGroup(symbol, method, session, startDate, endDate)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));