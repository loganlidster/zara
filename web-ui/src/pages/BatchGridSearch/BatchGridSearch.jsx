import React, { useState } from 'react';
import './BatchGridSearch.css';

const SYMBOLS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE'];
const METHODS = ['EQUAL_MEAN', 'WEIGHTED_MEDIAN', 'VOL_WEIGHTED', 'WINSORIZED', 'VWAP_RATIO'];

function BatchGridSearch() {
  const [params, setParams] = useState({
    symbols: ['RIOT'],
    methods: METHODS,
    buyPctMin: 0.3,
    buyPctMax: 0.9,
    sellPctMin: 0.1,
    sellPctMax: 0.8,
    startDate: '2025-09-15',
    endDate: '2025-09-15',
    session: 'RTH',
    initialCapital: 10000,
    allowShorts: false,
    conservativePricing: true,
    slippage: 0.1
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'totalReturn', direction: 'desc' });

  const handleSymbolToggle = (symbol) => {
    setParams(prev => ({
      ...prev,
      symbols: prev.symbols.includes(symbol)
        ? prev.symbols.filter(s => s !== symbol)
        : [...prev.symbols, symbol]
    }));
  };

  const handleMethodToggle = (method) => {
    setParams(prev => ({
      ...prev,
      methods: prev.methods.includes(method)
        ? prev.methods.filter(m => m !== method)
        : [...prev.methods, method]
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    }));
  };

  const calculateTotalCombinations = () => {
    const buySteps = Math.round((params.buyPctMax - params.buyPctMin) / 0.1) + 1;
    const sellSteps = Math.round((params.sellPctMax - params.sellPctMin) / 0.1) + 1;
    return params.symbols.length * params.methods.length * buySteps * sellSteps;
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortedResults = () => {
    if (!results || !results.results) return [];
    
    const sorted = [...results.results].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (params.symbols.length === 0) {
      alert('Please select at least one symbol');
      return;
    }
    
    if (params.methods.length === 0) {
      alert('Please select at least one method');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/batch-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error('Batch simulation failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!results || !results.results) return;

    const sortedResults = getSortedResults();
    const headers = ['Rank', 'Symbol', 'Method', 'Buy %', 'Sell %', 'Total Return %', 'Final Equity', 'Total Trades'];
    const rows = sortedResults.map((r, idx) => [
      idx + 1,
      r.symbol,
      r.method,
      r.buyPct,
      r.sellPct,
      r.totalReturn,
      r.finalEquity,
      r.totalTrades
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const totalCombinations = calculateTotalCombinations();

  return (
    <div className="batch-grid-search">
      <div className="batch-header">
        <h1>🔥 Batch Grid Search</h1>
        <p>Test hundreds of parameter combinations to find optimal settings</p>
      </div>

      <form onSubmit={handleSubmit} className="batch-form">
        {/* Stock Selection */}
        <div className="form-section">
          <h3>📊 Select Stocks ({params.symbols.length} selected)</h3>
          <div className="symbol-grid">
            {SYMBOLS.map(symbol => (
              <label key={symbol} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={params.symbols.includes(symbol)}
                  onChange={() => handleSymbolToggle(symbol)}
                />
                <span className={params.symbols.includes(symbol) ? 'selected' : ''}>{symbol}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Method Selection */}
        <div className="form-section">
          <h3>🎯 Select Methods ({params.methods.length} selected)</h3>
          <div className="method-grid">
            {METHODS.map(method => (
              <label key={method} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={params.methods.includes(method)}
                  onChange={() => handleMethodToggle(method)}
                />
                <span className={params.methods.includes(method) ? 'selected' : ''}>{method}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Parameter Ranges */}
        <div className="form-section">
          <h3>📈 Parameter Ranges</h3>
          <div className="range-grid">
            <div className="range-input">
              <label>Buy Threshold Min (%)</label>
              <input
                type="number"
                name="buyPctMin"
                value={params.buyPctMin}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
              />
            </div>
            <div className="range-input">
              <label>Buy Threshold Max (%)</label>
              <input
                type="number"
                name="buyPctMax"
                value={params.buyPctMax}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
              />
            </div>
            <div className="range-input">
              <label>Sell Threshold Min (%)</label>
              <input
                type="number"
                name="sellPctMin"
                value={params.sellPctMin}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
              />
            </div>
            <div className="range-input">
              <label>Sell Threshold Max (%)</label>
              <input
                type="number"
                name="sellPctMax"
                value={params.sellPctMax}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
              />
            </div>
          </div>
        </div>

        {/* Date Range & Session */}
        <div className="form-section">
          <h3>📅 Date Range & Session</h3>
          <div className="date-grid">
            <div className="form-input">
              <label>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={params.startDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-input">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={params.endDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-input">
              <label>Session</label>
              <select name="session" value={params.session} onChange={handleChange}>
                <option value="RTH">RTH (9:30 AM - 4:00 PM)</option>
                <option value="AH">AH (4:00 PM - 8:00 PM)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary & Submit */}
        <div className="batch-summary">
          <div className="summary-box">
            <h4>Total Combinations</h4>
            <div className="big-number">{totalCombinations.toLocaleString()}</div>
            <p className="summary-detail">
              {params.symbols.length} stocks × {params.methods.length} methods × 
              {Math.round((params.buyPctMax - params.buyPctMin) / 0.1) + 1} buy × 
              {Math.round((params.sellPctMax - params.sellPctMin) / 0.1) + 1} sell
            </p>
          </div>
          
          <button type="submit" className="run-batch-button" disabled={loading}>
            {loading ? '⏳ Running...' : '🚀 Run Batch Search'}
          </button>
        </div>
      </form>

      {/* Results */}
      {results && (
        <div className="batch-results">
          <div className="results-header">
            <h2>📊 Results ({results.results.length} simulations)</h2>
            <button onClick={exportToCSV} className="export-button">
              📥 Download All Results CSV
            </button>
          </div>

          <div className="results-summary">
            <div className="summary-card">
              <h4>Best Return</h4>
              <div className="big-stat positive">{results.summary.bestReturn.toFixed(2)}%</div>
            </div>
            <div className="summary-card">
              <h4>Average Return</h4>
              <div className="big-stat">{results.summary.avgReturn.toFixed(2)}%</div>
            </div>
            <div className="summary-card">
              <h4>Worst Return</h4>
              <div className="big-stat negative">{results.summary.worstReturn.toFixed(2)}%</div>
            </div>
            <div className="summary-card">
              <h4>Successful Sims</h4>
              <div className="big-stat">{results.successfulSimulations}</div>
            </div>
          </div>

          <div className="results-table-container">
            <p className="sort-hint">💡 Click column headers to sort</p>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th onClick={() => handleSort('symbol')} className="sortable">
                    Symbol {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('method')} className="sortable">
                    Method {sortConfig.key === 'method' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('buyPct')} className="sortable">
                    Buy % {sortConfig.key === 'buyPct' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('sellPct')} className="sortable">
                    Sell % {sortConfig.key === 'sellPct' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('totalReturn')} className="sortable">
                    Return % {sortConfig.key === 'totalReturn' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('finalEquity')} className="sortable">
                    Final Equity {sortConfig.key === 'finalEquity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('totalTrades')} className="sortable">
                    Trades {sortConfig.key === 'totalTrades' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {getSortedResults().map((result, idx) => (
                  <tr key={idx} className={idx === 0 ? 'top-result' : ''}>
                    <td>{idx + 1}</td>
                    <td><strong>{result.symbol}</strong></td>
                    <td>{result.method}</td>
                    <td>{result.buyPct}%</td>
                    <td>{result.sellPct}%</td>
                    <td className={result.totalReturn > 0 ? 'positive' : 'negative'}>
                      {result.totalReturn > 0 ? '+' : ''}{result.totalReturn}%
                    </td>
                    <td>${result.finalEquity.toLocaleString()}</td>
                    <td>{result.totalTrades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchGridSearch;