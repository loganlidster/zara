/**
 * Crypto Daily Curve Endpoint
 * 
 * Returns events for a single crypto with baseline and price data
 * Similar to stock daily-curve but for 24/7 crypto trading
 */

export default async function handleCryptoDailyCurve(req, res, pool) {
  const { symbol, method, buy_pct, sell_pct, start_date, end_date } = req.query;

  // Validation
  if (!symbol || !method) {
    return res.status(400).json({ 
      error: 'Missing required parameters: symbol, method' 
    });
  }

  const validMethods = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
  if (!validMethods.includes(method.toUpperCase())) {
    return res.status(400).json({ 
      error: `Invalid method. Must be one of: ${validMethods.join(', ')}` 
    });
  }

  const tableName = `trade_events_crypto_${method.toLowerCase()}`;
  
  try {
    const client = await pool.connect();
    
    try {
      // Build WHERE clause
      let whereConditions = ['e.symbol = $1'];
      const params = [symbol.toUpperCase()];
      let paramIndex = 2;

      if (buy_pct) {
        whereConditions.push(`e.buy_pct = $${paramIndex}`);
        params.push(parseFloat(buy_pct));
        paramIndex++;
      }

      if (sell_pct) {
        whereConditions.push(`e.sell_pct = $${paramIndex}`);
        params.push(parseFloat(sell_pct));
        paramIndex++;
      }

      if (start_date) {
        whereConditions.push(`DATE(e.event_timestamp) >= $${paramIndex}`);
        params.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`DATE(e.event_timestamp) <= $${paramIndex}`);
        params.push(end_date);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get events with baseline data
      const query = `
        SELECT 
          TO_CHAR(e.event_timestamp, 'MM/DD/YYYY HH24:MI:SS') as event_timestamp,
          e.event_type,
          e.crypto_price,
          e.btc_price,
          e.ratio,
          e.baseline,
          e.buy_pct,
          e.sell_pct,
          ((e.ratio - e.baseline) / e.baseline * 100) as deviation_pct
        FROM ${tableName} e
        WHERE ${whereClause}
        ORDER BY e.event_timestamp
      `;

      const result = await client.query(query, params);

      // Format dates as strings to avoid timezone issues
      const events = result.rows.map(row => ({
        ...row,
        event_timestamp: row.event_timestamp,
        crypto_price: parseFloat(row.crypto_price),
        btc_price: parseFloat(row.btc_price),
        ratio: parseFloat(row.ratio),
        baseline: parseFloat(row.baseline),
        buy_pct: parseFloat(row.buy_pct),
        sell_pct: parseFloat(row.sell_pct),
        deviation_pct: parseFloat(row.deviation_pct)
      }));

      // Get minute data for the chart (crypto prices and baselines)
      const minuteQuery = `
        SELECT 
          TO_CHAR(mc.timestamp, 'MM/DD/YYYY HH24:MI:SS') as timestamp,
          mc.close as crypto_price,
          mbc.close as btc_price,
          mbc.close / mc.close as ratio,
          bd.baseline
        FROM minute_crypto mc
        JOIN minute_btc_crypto mbc ON mc.timestamp = mbc.timestamp
        LEFT JOIN baseline_daily_crypto bd ON 
          bd.symbol = mc.symbol 
          AND bd.method = $1
          AND bd.trading_day = DATE(mc.timestamp)
        WHERE mc.symbol = $2
          ${start_date ? `AND DATE(mc.timestamp) >= $3` : ''}
          ${end_date ? `AND DATE(mc.timestamp) <= $${start_date ? 4 : 3}` : ''}
        ORDER BY mc.timestamp
      `;

      const minuteParams = [method.toUpperCase(), symbol.toUpperCase()];
      if (start_date) minuteParams.push(start_date);
      if (end_date) minuteParams.push(end_date);

      const minuteResult = await client.query(minuteQuery, minuteParams);

      const minuteData = minuteResult.rows.map(row => ({
        timestamp: row.timestamp,
        crypto_price: parseFloat(row.crypto_price),
        btc_price: parseFloat(row.btc_price),
        ratio: parseFloat(row.ratio),
        baseline: row.baseline ? parseFloat(row.baseline) : null
      }));

      res.json({
        symbol: symbol.toUpperCase(),
        method: method.toUpperCase(),
        buy_pct: buy_pct ? parseFloat(buy_pct) : null,
        sell_pct: sell_pct ? parseFloat(sell_pct) : null,
        events,
        minuteData,
        totalEvents: events.length,
        dateRange: {
          start: start_date || (minuteData.length > 0 ? minuteData[0].timestamp.split('T')[0] : null),
          end: end_date || (minuteData.length > 0 ? minuteData[minuteData.length - 1].timestamp.split('T')[0] : null)
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error in crypto daily curve:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}