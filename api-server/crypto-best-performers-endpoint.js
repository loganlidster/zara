/**
 * Crypto Best Performers Endpoint
 * 
 * Returns grid of best performing buy/sell combinations
 * Calculates returns for each combination
 */

export default async function handleCryptoBestPerformers(req, res, pool) {
  const { 
    symbol, 
    method, 
    start_date, 
    end_date,
    min_trades = 10,
    sort_by = 'total_return',
    limit = 100
  } = req.query;

  // Validation
  if (!method) {
    return res.status(400).json({ 
      error: 'Missing required parameter: method' 
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
      let whereConditions = [];
      const params = [];
      let paramIndex = 1;

      if (symbol) {
        whereConditions.push(`symbol = $${paramIndex}`);
        params.push(symbol.toUpperCase());
        paramIndex++;
      }

      if (start_date) {
        whereConditions.push(`DATE(event_timestamp) >= $${paramIndex}`);
        params.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        whereConditions.push(`DATE(event_timestamp) <= $${paramIndex}`);
        params.push(end_date);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Calculate performance for each combination
      const query = `
        WITH trades AS (
          SELECT 
            symbol,
            buy_pct,
            sell_pct,
            TO_CHAR(event_timestamp, 'MM/DD/YYYY HH24:MI:SS') as event_timestamp,
            event_type,
            crypto_price,
            LAG(crypto_price) OVER (PARTITION BY symbol, buy_pct, sell_pct ORDER BY event_timestamp) as prev_price,
            LAG(event_type) OVER (PARTITION BY symbol, buy_pct, sell_pct ORDER BY event_timestamp) as prev_event
          FROM ${tableName}
          ${whereClause}
        ),
        completed_trades AS (
          SELECT 
            symbol,
            buy_pct,
            sell_pct,
            prev_price as buy_price,
            crypto_price as sell_price,
            ((crypto_price - prev_price) / prev_price * 100) as return_pct
          FROM trades
          WHERE event_type = 'SELL' AND prev_event = 'BUY'
        )
        SELECT 
          symbol,
          buy_pct,
          sell_pct,
          COUNT(*) as num_trades,
          SUM(return_pct) as total_return,
          AVG(return_pct) as avg_return,
          STDDEV(return_pct) as stddev_return,
          MIN(return_pct) as min_return,
          MAX(return_pct) as max_return,
          SUM(CASE WHEN return_pct > 0 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN return_pct <= 0 THEN 1 ELSE 0 END) as losing_trades,
          (SUM(CASE WHEN return_pct > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as win_rate
        FROM completed_trades
        GROUP BY symbol, buy_pct, sell_pct
        HAVING COUNT(*) >= $${paramIndex}
        ORDER BY ${sort_by === 'win_rate' ? 'win_rate' : 
                  sort_by === 'avg_return' ? 'avg_return' : 
                  sort_by === 'num_trades' ? 'num_trades' : 
                  'total_return'} DESC
        LIMIT $${paramIndex + 1}
      `;

      params.push(parseInt(min_trades));
      params.push(parseInt(limit));

      const result = await client.query(query, params);

      const performers = result.rows.map(row => ({
        symbol: row.symbol,
        buy_pct: parseFloat(row.buy_pct),
        sell_pct: parseFloat(row.sell_pct),
        num_trades: parseInt(row.num_trades),
        total_return: parseFloat(row.total_return),
        avg_return: parseFloat(row.avg_return),
        stddev_return: row.stddev_return ? parseFloat(row.stddev_return) : null,
        min_return: parseFloat(row.min_return),
        max_return: parseFloat(row.max_return),
        winning_trades: parseInt(row.winning_trades),
        losing_trades: parseInt(row.losing_trades),
        win_rate: parseFloat(row.win_rate)
      }));

      res.json({
        method: method.toUpperCase(),
        symbol: symbol ? symbol.toUpperCase() : 'ALL',
        dateRange: {
          start: start_date || null,
          end: end_date || null
        },
        filters: {
          min_trades: parseInt(min_trades),
          sort_by
        },
        performers,
        totalResults: performers.length
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error in crypto best performers:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}