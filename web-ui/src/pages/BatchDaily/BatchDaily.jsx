import React, { useState } from 'react';
import './BatchDaily.css';

const BatchDaily = () => {
  const [symbols, setSymbols] = useState(['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE']);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-26');
  const [methods, setMethods] = useState(['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN']);
  const [lookbackDays, setLookbackDays] = useState(1);
  const [buyStart, setBuyStart] = useState(0.5);
  const [buyEnd, setBuyEnd] = useState(2.0);
  const [buyStep, setBuyStep] = useState(0.5);
  const [sellStart, setSellStart] = useState(1.0);
  const [sellEnd, setSellEnd] = useState(4.0);
  const [sellStep, setSellStep] = useState(0.5);
  const [confidenceHorizon, setConfidenceHorizon] = useState(10);
  const [loading, setLoading] = useState(false);
  const [dailyWinners, setDailyWinners] = useState([]);
  const [consistencySummary, setConsistencySummary] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const allSymbols = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
  const allMethods = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];

  const handleSymbolToggle = (symbol) => {
    setSymbols(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleMethodToggle = (method) => {
    setMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const generateThresholds = (start, end, step) => {
    const thresholds = [];
    for (let i = start; i <= end; i += step) {
      thresholds.push(parseFloat(i.toFixed(1)));
    }
    return thresholds;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const buyThresholds = generateThresholds(buyStart, buyEnd, buyStep);
      const sellThresholds = generateThresholds(sellStart, sellEnd, sellStep);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/batch-daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          startDate,
          endDate,
          methods,
          lookbackDays,
          buyThresholds,
          sellThresholds,
          confidenceHorizon
        })
      });

      const data = await response.json();
      setDailyWinners(data.dailyWinners);
      setConsistencySummary(data.consistencySummary);
    } catch (error) {
      console.error('Error:', error);
      alert('Error running batch daily analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key, data, setData) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    const sorted = [...data].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setData(sorted);
    setSortConfig({ key, direction });
  };

  const exportToCSV = (data, filename) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="batch-daily-container">
      <h2>Batch Daily Analysis</h2>
      <p className="subtitle">Find the best settings for each day</p>

      <form onSubmit={handleSubmit} className="batch-daily-form">
        <div className="form-section">
          <h3>Symbols</h3>
          <div className="checkbox-grid">
            {allSymbols.map(symbol => (
              <label key={symbol} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={symbols.includes(symbol)}
                  onChange={() => handleSymbolToggle(symbol)}
                />
                {symbol}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Date Range</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Baseline Methods</h3>
          <div className="checkbox-grid">
            {allMethods.map(method => (
              <label key={method} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={methods.includes(method)}
                  onChange={() => handleMethodToggle(method)}
                />
                {method}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Settings</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Lookback Days</label>
              <input
                type="number"
                min="1"
                max="5"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Confidence Horizon (minutes)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={confidenceHorizon}
                onChange={(e) => setConfidenceHorizon(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Buy Thresholds (%)</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Start</label>
              <input
                type="number"
                step="0.1"
                value={buyStart}
                onChange={(e) => setBuyStart(parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>End</label>
              <input
                type="number"
                step="0.1"
                value={buyEnd}
                onChange={(e) => setBuyEnd(parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Step</label>
              <input
                type="number"
                step="0.1"
                value={buyStep}
                onChange={(e) => setBuyStep(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Sell Thresholds (%)</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Start</label>
              <input
                type="number"
                step="0.1"
                value={sellStart}
                onChange={(e) => setSellStart(parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>End</label>
              <input
                type="number"
                step="0.1"
                value={sellEnd}
                onChange={(e) => setSellEnd(parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Step</label>
              <input
                type="number"
                step="0.1"
                value={sellStep}
                onChange={(e) => setSellStep(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Running Analysis...' : 'Run Batch Daily'}
        </button>
      </form>

      {dailyWinners.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>Daily Winners ({dailyWinners.length} days)</h3>
            <button 
              onClick={() => exportToCSV(dailyWinners, `daily-winners-${startDate}-${endDate}.csv`)}
              className="export-button"
            >
              Export CSV
            </button>
          </div>
          <div className="table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('date', dailyWinners, setDailyWinners)}>Date</th>
                  <th onClick={() => handleSort('symbol', dailyWinners, setDailyWinners)}>Symbol</th>
                  <th onClick={() => handleSort('method', dailyWinners, setDailyWinners)}>Method</th>
                  <th onClick={() => handleSort('buyPct', dailyWinners, setDailyWinners)}>Buy %</th>
                  <th onClick={() => handleSort('sellPct', dailyWinners, setDailyWinners)}>Sell %</th>
                  <th onClick={() => handleSort('trades', dailyWinners, setDailyWinners)}>Trades</th>
                  <th onClick={() => handleSort('returnPct', dailyWinners, setDailyWinners)}>Return %</th>
                  <th onClick={() => handleSort('confidence', dailyWinners, setDailyWinners)}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {dailyWinners.map((winner, idx) => (
                  <tr key={idx}>
                    <td>{new Date(winner.date).toLocaleDateString()}</td>
                    <td>{winner.symbol}</td>
                    <td>{winner.method}</td>
                    <td>{winner.buyPct.toFixed(1)}</td>
                    <td>{winner.sellPct.toFixed(1)}</td>
                    <td>{winner.trades}</td>
                    <td className={winner.returnPct >= 0 ? 'positive' : 'negative'}>
                      {winner.returnPct.toFixed(2)}%
                    </td>
                    <td>{winner.confidence ? winner.confidence.toFixed(2) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {consistencySummary.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>Consistency Summary</h3>
            <button 
              onClick={() => exportToCSV(consistencySummary, `consistency-summary-${startDate}-${endDate}.csv`)}
              className="export-button"
            >
              Export CSV
            </button>
          </div>
          <div className="table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('symbol', consistencySummary, setConsistencySummary)}>Symbol</th>
                  <th onClick={() => handleSort('method', consistencySummary, setConsistencySummary)}>Method</th>
                  <th onClick={() => handleSort('daysWon', consistencySummary, setConsistencySummary)}>Days Won</th>
                  <th onClick={() => handleSort('avgReturn', consistencySummary, setConsistencySummary)}>Avg Return %</th>
                  <th onClick={() => handleSort('medianReturn', consistencySummary, setConsistencySummary)}>Median Return %</th>
                  <th onClick={() => handleSort('avgConfidence', consistencySummary, setConsistencySummary)}>Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {consistencySummary.map((summary, idx) => (
                  <tr key={idx}>
                    <td>{summary.symbol}</td>
                    <td>{summary.method}</td>
                    <td>{summary.daysWon}</td>
                    <td className={summary.avgReturn >= 0 ? 'positive' : 'negative'}>
                      {summary.avgReturn.toFixed(2)}%
                    </td>
                    <td className={summary.medianReturn >= 0 ? 'positive' : 'negative'}>
                      {summary.medianReturn.toFixed(2)}%
                    </td>
                    <td>{summary.avgConfidence.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDaily;