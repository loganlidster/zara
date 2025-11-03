import { pool } from './db.js';

/**
 * Crypto Daily Curve - Optimized for existing event data
 * Shows cumulative returns over time for a specific combination
 */
export async function cryptoDailyCurveSimple(req, res) {
  try {
    const { symbol, method, buy_pct, sell_pct, start_date, end_date } = req.query;

    if (!symbol || !method || !buy_pct || !sell_pct) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol, method, buy_pct, sell_pct'
      });
    }

    const tableName = `trade_events_crypto_${method.toLowerCase()}`;
    
    console.log(`Daily Curve: ${tableName} for ${symbol} ${buy_pct}/${sell_pct} from ${start_date || 'all'} to ${end_date || 'all'}`);
    
    // Get all SELL events (completed trades) with their ROI
    const query = `
      SELECT 
        event_timestamp::date as trade_date,
        event_timestamp,
        trade_roi_pct
      FROM ${tableName}
      WHERE symbol = $1
        AND buy_pct = $2
        AND sell_pct = $3
        AND event_type = 'SELL'
        ${start_date ? 'AND event_timestamp >= $4::date' : ''}
        ${end_date ? 'AND event_timestamp <= $5::date' : ''}
      ORDER BY event_timestamp
    `;

    const params = [symbol, parseFloat(buy_pct), parseFloat(sell_pct)];
    if (start_date) params.push(start_date);
    if (end_date) params.push(end_date);

    const result = await pool.query(query, params);

    // Calculate cumulative returns
    let cumulativeReturn = 0;
    const curveData = result.rows.map(row => {
      cumulativeReturn += parseFloat(row.trade_roi_pct || 0);
      return {
        date: row.trade_date,
        timestamp: row.event_timestamp,
        trade_roi: parseFloat(parseFloat(row.trade_roi_pct).toFixed(2)),
        cumulative_return: parseFloat(cumulativeReturn.toFixed(2))
      };
    });

    // Calculate summary stats
    const totalTrades = result.rows.length;
    const winningTrades = result.rows.filter(r => parseFloat(r.trade_roi_pct) > 0).length;
    const losingTrades = result.rows.filter(r => parseFloat(r.trade_roi_pct) < 0).length;
    const avgReturn = totalTrades > 0 
      ? result.rows.reduce((sum, r) => sum + parseFloat(r.trade_roi_pct), 0) / totalTrades 
      : 0;

    res.json({
      success: true,
      symbol,
      method,
      buy_pct: parseFloat(buy_pct),
      sell_pct: parseFloat(sell_pct),
      start_date: start_date || 'all',
      end_date: end_date || 'all',
      summary: {
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        win_rate: totalTrades > 0 ? parseFloat((winningTrades / totalTrades * 100).toFixed(2)) : 0,
        avg_return: parseFloat(avgReturn.toFixed(2)),
        total_return: parseFloat(cumulativeReturn.toFixed(2))
      },
      curve: curveData
    });

  } catch (error) {
    console.error('Crypto daily curve error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}