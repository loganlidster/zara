import pool from './db.js';

/**
 * Crypto Fast Daily - Optimized for existing event data
 * Shows top performing combinations quickly
 */
export async function cryptoFastDailySimple(req, res) {
  try {
    const { symbol, method, buy_pct, sell_pct, start_date, end_date, limit } = req.query;

    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: method'
      });
    }

    const tableName = `trade_events_crypto_${method.toLowerCase()}`;
    
    // Build WHERE clause
    let whereConditions = ['event_type = \'SELL\''];  // Only completed trades
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
      whereConditions.push(`event_timestamp >= $${paramIndex}::date`);
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`event_timestamp <= $${paramIndex}::date`);
      params.push(end_date);
      paramIndex++;
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : 'LIMIT 50';

    // Aggregate by symbol and combination
    const query = `
      SELECT 
        symbol,
        buy_pct,
        sell_pct,
        COUNT(*) as num_trades,
        SUM(trade_roi_pct) as total_return,
        AVG(trade_roi_pct) as avg_return,
        MIN(trade_roi_pct) as min_return,
        MAX(trade_roi_pct) as max_return,
        SUM(CASE WHEN trade_roi_pct > 0 THEN 1 ELSE 0 END) as winning_trades,
        (SUM(CASE WHEN trade_roi_pct > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as win_rate
      FROM ${tableName}
      ${whereClause}
      GROUP BY symbol, buy_pct, sell_pct
      ORDER BY total_return DESC
      ${limitClause}
    `;

    console.log(`Fast Daily: ${tableName} with filters:`, { symbol, buy_pct, sell_pct, start_date, end_date });

    const result = await pool.query(query, params);

    const summary = result.rows.map(row => ({
      symbol: row.symbol,
      buy_pct: parseFloat(row.buy_pct),
      sell_pct: parseFloat(row.sell_pct),
      num_trades: parseInt(row.num_trades),
      total_return: parseFloat(parseFloat(row.total_return).toFixed(2)),
      avg_return: parseFloat(parseFloat(row.avg_return).toFixed(2)),
      min_return: parseFloat(parseFloat(row.min_return).toFixed(2)),
      max_return: parseFloat(parseFloat(row.max_return).toFixed(2)),
      winning_trades: parseInt(row.winning_trades),
      win_rate: parseFloat(parseFloat(row.win_rate).toFixed(2))
    }));

    res.json({
      success: true,
      symbol: symbol ? symbol.toUpperCase() : 'ALL',
      method,
      start_date: start_date || 'all',
      end_date: end_date || 'all',
      results: summary,
      total_combinations: summary.length
    });

  } catch (error) {
    console.error('Crypto fast daily error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}