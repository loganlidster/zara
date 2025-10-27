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

        events.push({
          event_timestamp: timestamp,
          event_type: 'BUY',
          stock_price: Math.round(stock_price * 10000) / 10000, // Round to 4 decimals
          btc_price: Math.round(btc_price * 100) / 100, // Round to 2 decimals
          ratio: Math.round(ratio * 10000) / 10000, // Round to 4 decimals
          shares: sharesToBuy,
          transaction_value: Math.round(transactionValue * 100) / 100, // Round to 2 decimals
          cash_balance: Math.round(cash * 100) / 100, // Round to 2 decimals
          shares_held: shares,
          position_value: Math.round((shares * stock_price) * 100) / 100, // Round to 2 decimals
          total_value: Math.round((cash + (shares * stock_price)) * 100) / 100 // Round to 2 decimals
        });
      }
    }
    else if (shares > 0 && ratio <= sellThreshold) {
      const transactionValue = shares * stock_price;
      cash += transactionValue;
      const soldShares = shares;
      shares = 0;

      events.push({
        event_timestamp: timestamp,
        event_type: 'SELL',
        stock_price: Math.round(stock_price * 10000) / 10000, // Round to 4 decimals
        btc_price: Math.round(btc_price * 100) / 100, // Round to 2 decimals
        ratio: Math.round(ratio * 10000) / 10000, // Round to 4 decimals
        shares: soldShares,
        transaction_value: Math.round(transactionValue * 100) / 100, // Round to 2 decimals
        cash_balance: Math.round(cash * 100) / 100, // Round to 2 decimals
        shares_held: shares,
        position_value: 0,
        total_value: Math.round(cash * 100) / 100 // Round to 2 decimals
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
        event_timestamp, event_type, stock_price, btc_price, ratio,
        shares, transaction_value, cash_balance, shares_held,
        position_value, total_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (symbol, method, session, buy_pct, sell_pct, event_timestamp) 
      DO NOTHING
    `;

    for (const event of events) {
      await client.query(insertQuery, [
        symbol, method, session, buyPct, sellPct,
        event.event_timestamp, event.event_type, event.stock_price,
        event.btc_price, event.ratio, event.shares, event.transaction_value,
        event.cash_balance, event.shares_held, event.position_value,
        event.total_value
      ]);
    }

    const lastEvent = events[events.length - 1];
    const buyCount = events.filter(e => e.event_type === 'BUY').length;
    const sellCount = events.filter(e => e.event_type === 'SELL').length;
    const finalROI = ((lastEvent.total_value - INITIAL_CASH) / INITIAL_CASH) * 100;

    const metadataQuery = `
      INSERT INTO simulation_metadata (
        symbol, method, session, buy_pct, sell_pct,
        status, first_event_date, last_event_date, last_processed_date,
        total_events, total_buys, total_sells, final_total_value, final_roi_pct,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (symbol, method, session, buy_pct, sell_pct)
      DO UPDATE SET
        status = $6,
        last_event_date = $8,
        last_processed_date = $9,
        total_events = simulation_metadata.total_events + $10,
        total_buys = simulation_metadata.total_buys + $11,
        total_sells = simulation_metadata.total_sells + $12,
        final_total_value = $13,
        final_roi_pct = $14,
        updated_at = NOW()
    `;

    await client.query(metadataQuery, [
      symbol, method, session, buyPct, sellPct,
      'completed',
      events[0].event_timestamp,
      lastEvent.event_timestamp,
      lastEvent.event_timestamp,
      events.length,
      buyCount,
      sellCount,
      lastEvent.total_value,
      finalROI
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