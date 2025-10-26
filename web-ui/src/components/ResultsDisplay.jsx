import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './ResultsDisplay.css'

function ResultsDisplay({ results }) {
  if (!results) return null

  const exportToCSV = () => {
    const { tradeLog, symbol, method, buyPct, sellPct, session, startDate, endDate } = results
    
    // Create CSV header
    const headers = ['Date', 'Time', 'Action', 'Shares', 'Price', 'Value', 'Stock Delta %', 'BTC Delta %', 'Baseline', 'Current Ratio', 'Prev Baseline Date']
    
    // Create CSV rows
    const rows = tradeLog.map(trade => [
      trade.date,
      trade.time,
      trade.action,
      trade.shares,
      parseFloat(trade.price).toFixed(2),
      parseFloat(trade.value).toFixed(2),
         trade.stock_delta !== 0 ? parseFloat(trade.stock_delta).toFixed(2) : "",
         trade.btc_delta !== 0 ? parseFloat(trade.btc_delta).toFixed(2) : "",
      parseFloat(trade.baseline).toFixed(2),
      trade.current_ratio ? parseFloat(trade.current_ratio).toFixed(6) : '',
      trade.prev_baseline_date || ''
    ])
    
    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    const filename = `${symbol}_${method}_${startDate}_${endDate}_${buyPct}buy_${sellPct}sell_${session}.csv`
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const { 
    symbol,
    sessionMode,
    method, 
    buyPct, 
    sellPct, 
    session,
    rthMethod,
    rthBuyPct,
    rthSellPct,
    ahMethod,
    ahBuyPct,
    ahSellPct,
    startDate,
    endDate,
    initialCapital,
    finalEquity,
    totalReturn,
    trades,
    completedTrades,
    winningTrades,
    winRate,
    tradeLog,
    dailyPerformance
  } = results

  // Prepare equity curve data
  const equityCurveData = dailyPerformance?.map(day => ({
    date: day.date,
    equity: day.end_equity,
    return: day.return_pct
  })) || []

  return (
    <div className="results-container">
      <div className="results-header">
        <div className="results-header-top">
          <h2>📈 Simulation Results</h2>
          <button onClick={exportToCSV} className="export-button">
            📥 Download CSV
          </button>
        </div>
        <div className="results-params">
          <span className="param-badge">{symbol}</span>
          {sessionMode === 'SINGLE' ? (
            <>
              <span className="param-badge">{method}</span>
              <span className="param-badge">{session}</span>
              <span className="param-badge">Buy: {buyPct}%</span>
              <span className="param-badge">Sell: {sellPct}%</span>
            </>
          ) : (
            <>
              <span className="param-badge">All Hours</span>
              <span className="param-badge">RTH: {rthMethod} ({rthBuyPct}%/{rthSellPct}%)</span>
              <span className="param-badge">AH: {ahMethod} ({ahBuyPct}%/{ahSellPct}%)</span>
            </>
          )}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Return</div>
          <div className={`metric-value ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Final Equity</div>
          <div className="metric-value">${finalEquity.toFixed(2)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Trades</div>
          <div className="metric-value">{trades}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Win Rate</div>
          <div className="metric-value">{winRate.toFixed(1)}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Winning Trades</div>
          <div className="metric-value">{winningTrades}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Completed Trades</div>
          <div className="metric-value">{completedTrades}</div>
        </div>
      </div>

      {equityCurveData.length > 0 && (
        <div className="chart-container">
          <h3>Equity Curve</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equityCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="equity" 
                stroke="#667eea" 
                strokeWidth={2}
                dot={{ fill: '#667eea' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tradeLog && tradeLog.length > 0 && (
        <div className="trades-container">
          <h3>Trade Log ({tradeLog.length} trades)</h3>
          <div className="trades-table-wrapper">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Session</th>
                  <th>Method</th>
                  <th>Action</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Value</th>
                     <th>Delta</th>
                     <th>BTC Δ</th>
                  <th>Baseline</th>
                </tr>
              </thead>
              <tbody>
                {tradeLog.map((trade, idx) => (
                  <tr key={idx}>
                    <td>{trade.date}</td>
                    <td>{trade.time}</td>
                    <td>
                      <span className={`session-badge ${trade.session?.toLowerCase()}`}>
                        {trade.session || session}
                      </span>
                    </td>
                    <td>{trade.method || method}</td>
                    <td>
                      <span className={`action-badge ${trade.action.toLowerCase()}`}>
                        {trade.action}
                      </span>
                    </td>
                    <td>{trade.shares}</td>
                    <td>${parseFloat(trade.price).toFixed(2)}</td>
                    <td>${parseFloat(trade.value).toFixed(2)}</td>
                       <td className={trade.stock_delta > 0 ? "delta-positive" : trade.stock_delta < 0 ? "delta-negative" : ""}>
                         {trade.stock_delta !== 0 ? `${trade.stock_delta > 0 ? "+" : ""}${parseFloat(trade.stock_delta).toFixed(2)}%` : "-"}
                       </td>
                       <td className={trade.btc_delta > 0 ? "delta-positive" : trade.btc_delta < 0 ? "delta-negative" : ""}>
                         {trade.btc_delta !== 0 ? `${trade.btc_delta > 0 ? "+" : ""}${parseFloat(trade.btc_delta).toFixed(2)}%` : "-"}
                       </td>
                    <td>{parseFloat(trade.baseline).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsDisplay