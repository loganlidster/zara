/**
 * Crypto Fast Daily Events Endpoint
 * 
 * Returns individual trade events for crypto trading
 * Similar to stock Fast Daily but for crypto (no sessions)
 */

import pool from './db.js';

export default async function handler(req, res) {
  const { 
    symbol, 
    method,
    buy_pct,
    sell_pct,
    start_date, 
    end_date
  } = req.query;

  // Validate required parameters
  if (!symbol || !method || !buy_pct || !sell_pct) {
    return res.status(400).json({ 
      error: 'Missing required parameters: symbol, method, buy_pct, sell_pct' 
    });
  }

  try {
    const validMethods = ['EQUAL_MEAN', 'WINSORIZED'];
    if (!validMethods.includes(method.toUpperCase())) {
      return res.status(400).json({ 
        error: `Invalid method. Must be one of: ${validMethods.join(', ')}` 
      });
    }

    const tableName = `trade_events_crypto_${method.toLowerCase()}`;
    
    // Build query
    const query = `
      SELECT 
        symbol,
        buy_pct,
        sell_pct,
        TO_CHAR(event_timestamp, 'MM/DD/YYYY HH24:MI:SS') as event_timestamp,
        event_type,
        crypto_price,
        btc_price,
        ratio,
        baseline,
        trade_roi_pct
      FROM ${tableName}
      WHERE symbol = $1
        AND buy_pct = $2
        AND sell_pct = $3
        ${start_date ? 'AND event_timestamp >= $4' : ''}
        ${end_date ? 'AND event_timestamp <= $5' : ''}
      ORDER BY event_timestamp ASC
    `;

    const params = [
      symbol.toUpperCase(),
      parseFloat(buy_pct),
      parseFloat(sell_pct)
    ];

    if (start_date) params.push(start_date);
    if (end_date) params.push(end_date);

    const result = await pool.query(query, params);

    // Convert string values to numbers
    const events = result.rows.map(event => ({
      ...event,
      crypto_price: parseFloat(event.crypto_price),
      btc_price: parseFloat(event.btc_price),
      ratio: parseFloat(event.ratio),
      baseline: parseFloat(event.baseline),
      trade_roi_pct: event.trade_roi_pct ? parseFloat(event.trade_roi_pct) : null
    }));

    res.status(200).json({
      success: true,
      symbol: symbol.toUpperCase(),
      method: method.toUpperCase(),
      buy_pct: parseFloat(buy_pct),
      sell_pct: parseFloat(sell_pct),
      events: events
    });

  } catch (error) {
    console.error('Error fetching crypto trade events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trade events',
      details: error.message 
    });
  }
}