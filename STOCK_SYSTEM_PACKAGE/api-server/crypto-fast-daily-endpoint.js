/**
 * Crypto Fast Daily Endpoint
 * 
 * Quick summary statistics for crypto trading
 * Shows performance by crypto and method
 */

export default async function handleCryptoFastDaily(req, res, pool) {
  const { 
    symbol, 
    method,
    buy_pct,
    sell_pct,
    start_date, 
    end_date
  } = req.query;

  try {
    const client = await pool.connect();
    
    try {
      // If method specified, query single table
      if (method) {
        const validMethods = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
        if (!validMethods.includes(method.toUpperCase())) {
          return res.status(400).json({ 
            error: `Invalid method. Must be one of: ${validMethods.join(', ')}` 
          });
        }

        const tableName = `trade_events_crypto_${method.toLowerCase()}`;
        
        // Build WHERE clause
        let whereConditions = [];
        const params = [];
        let paramIndex = 1;

        if (symbol) {
          whereConditions.push(`symbol = $${paramIndex}`);
          params.push(symbol.toUpperCase());
          paramIndex++;
        }

        if (buy_pct) {
          whereConditions.push(`buy_pct = $${paramIndex}`);
          params.push(parseFloat(buy_pct));
          paramIndex++;
        }

        if (sell_pct) {
          whereConditions.push(`sell_pct = $${paramIndex}`);
          params.push(parseFloat(sell_pct));
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

        const query = `
          WITH trades AS (
            SELECT 
              symbol,
              buy_pct,
              sell_pct,
              event_timestamp,
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
            MIN(return_pct) as min_return,
            MAX(return_pct) as max_return,
            SUM(CASE WHEN return_pct > 0 THEN 1 ELSE 0 END) as winning_trades,
            (SUM(CASE WHEN return_pct > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as win_rate
          FROM completed_trades
          GROUP BY symbol, buy_pct, sell_pct
          ORDER BY total_return DESC
        `;

        const result = await client.query(query, params);

        const summary = result.rows.map(row => ({
          symbol: row.symbol,
          buy_pct: parseFloat(row.buy_pct),
          sell_pct: parseFloat(row.sell_pct),
          num_trades: parseInt(row.num_trades),
          total_return: parseFloat(row.total_return),
          avg_return: parseFloat(row.avg_return),
          min_return: parseFloat(row.min_return),
          max_return: parseFloat(row.max_return),
          winning_trades: parseInt(row.winning_trades),
          win_rate: parseFloat(row.win_rate)
        }));

        return res.json({
          method: method.toUpperCase(),
          symbol: symbol ? symbol.toUpperCase() : 'ALL',
          summary,
          totalCombinations: summary.length
        });
      }

      // If no method specified, return summary across all methods
      const methods = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
      const allResults = [];

      for (const m of methods) {
        const tableName = `trade_events_crypto_${m.toLowerCase()}`;
        
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

        const query = `
          SELECT 
            '${m}' as method,
            COUNT(*) as total_events,
            COUNT(DISTINCT symbol) as num_cryptos,
            COUNT(DISTINCT CONCAT(buy_pct, '-', sell_pct)) as num_combinations
          FROM ${tableName}
          ${whereClause}
        `;

        const result = await client.query(query, params);
        if (result.rows.length > 0) {
          allResults.push({
            method: m,
            total_events: parseInt(result.rows[0].total_events),
            num_cryptos: parseInt(result.rows[0].num_cryptos),
            num_combinations: parseInt(result.rows[0].num_combinations)
          });
        }
      }

      res.json({
        symbol: symbol ? symbol.toUpperCase() : 'ALL',
        methods: allResults,
        totalMethods: allResults.length
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error in crypto fast daily:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}