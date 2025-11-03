import pool from './db.js';

/**
 * Crypto Grid Search - Optimized for existing event data
 * Shows all buy/sell combinations with performance metrics
 */
export async function cryptoGridSearchSimple(req, res) {
  try {
    const { symbol, method, start_date, end_date } = req.query;

    if (!symbol || !method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol, method'
      });
    }

    const tableName = `trade_events_crypto_${method.toLowerCase()}`;
    
    console.log(`Grid Search: ${tableName} for ${symbol} from ${start_date || 'all'} to ${end_date || 'all'}`);
    
    // Query existing event data - aggregate by buy/sell combination
    const query = `
      SELECT 
        buy_pct,
        sell_pct,
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'SELL' THEN 1 END) as completed_trades,
        SUM(CASE WHEN event_type = 'SELL' AND trade_roi_pct > 0 THEN 1 ELSE 0 END) as winning_trades,
        AVG(CASE WHEN event_type = 'SELL' THEN trade_roi_pct END) as avg_roi,
        SUM(CASE WHEN event_type = 'SELL' THEN trade_roi_pct ELSE 0 END) as total_return,
        MIN(CASE WHEN event_type = 'SELL' THEN trade_roi_pct END) as min_roi,
        MAX(CASE WHEN event_type = 'SELL' THEN trade_roi_pct END) as max_roi
      FROM ${tableName}
      WHERE symbol = $1
        ${start_date ? 'AND event_timestamp >= $2::date' : ''}
        ${end_date ? 'AND event_timestamp <= $3::date' : ''}
      GROUP BY buy_pct, sell_pct
      ORDER BY buy_pct, sell_pct
    `;

    const params = [symbol];
    if (start_date) params.push(start_date);
    if (end_date) params.push(end_date);

    const result = await pool.query(query, params);

    // Format for heatmap
    const heatmapData = result.rows.map(row => ({
      buy_pct: parseFloat(row.buy_pct),
      sell_pct: parseFloat(row.sell_pct),
      total_events: parseInt(row.total_events),
      completed_trades: parseInt(row.completed_trades || 0),
      winning_trades: parseInt(row.winning_trades || 0),
      win_rate: row.completed_trades > 0 
        ? parseFloat((row.winning_trades / row.completed_trades * 100).toFixed(2))
        : 0,
      avg_roi: row.avg_roi ? parseFloat(parseFloat(row.avg_roi).toFixed(2)) : 0,
      total_return: row.total_return ? parseFloat(parseFloat(row.total_return).toFixed(2)) : 0,
      min_roi: row.min_roi ? parseFloat(parseFloat(row.min_roi).toFixed(2)) : 0,
      max_roi: row.max_roi ? parseFloat(parseFloat(row.max_roi).toFixed(2)) : 0
    }));

    // Find best combination
    const bestCombo = heatmapData.reduce((best, current) => {
      return current.total_return > (best?.total_return || -Infinity) ? current : best;
    }, null);

    res.json({
      success: true,
      symbol,
      method,
      start_date: start_date || 'all',
      end_date: end_date || 'all',
      combinations: heatmapData.length,
      best_combination: bestCombo,
      data: heatmapData
    });

  } catch (error) {
    console.error('Crypto grid search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}