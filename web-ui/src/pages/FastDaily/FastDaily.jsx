import React, { useState } from 'react';
import './FastDaily.css';

const STOCKS = ['RIOT', 'MARA', 'CLSK', 'HUT', 'BTDR', 'CORZ', 'CIFR', 'CAN', 'HIVE', 'WULF', 'APLD'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

function FastDaily() {
  const [date, setDate] = useState('2024-01-02');
  const [selectedStocks, setSelectedStocks] = useState(['RIOT']);
  const [selectedMethods, setSelectedMethods] = useState(['EQUAL_MEAN']);
  const [buyThresholdMin, setBuyThresholdMin] = useState(0.1);
  const [buyThresholdMax, setBuyThresholdMax] = useState(3.0);
  const [sellThresholdMin, setSellThresholdMin] = useState(0.1);
  const [sellThresholdMax, setSellThresholdMax] = useState(3.0);
  const [sessionType, setSessionType] = useState('RTH');
  const [conservativePricing, setConservativePricing] = useState(true);
  const [slippage, setSlippage] = useState(0.0);
  const [allowShorts, setAllowShorts] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [sortField, setSortField] = useState('totalReturn');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleStockToggle = (stock) => {
    setSelectedStocks(prev => 
      prev.includes(stock) 
        ? prev.filter(s => s !== stock)
        : [...prev, stock]
    );
  };

  const handleMethodToggle = (method) => {
    setSelectedMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const handleSelectAllStocks = () => {
    setSelectedStocks(STOCKS);
  };

  const handleDeselectAllStocks = () => {
    setSelectedStocks([]);
  };

  const handleSelectAllMethods = () => {
    setSelectedMethods(METHODS);
  };

  const handleDeselectAllMethods = () => {
    setSelectedMethods([]);
  };

  const calculateCombinations = () => {
    const buyCount = Math.floor((buyThresholdMax - buyThresholdMin) / 0.1) + 1;
    const sellCount = Math.floor((sellThresholdMax - sellThresholdMin) / 0.1) + 1;
    return selectedStocks.length * selectedMethods.length * buyCount * sellCount;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedStocks.length === 0) {
      alert('Please select at least one stock');
      return;
    }
    
    if (selectedMethods.length === 0) {
      alert('Please select at least one method');
      return;
    }
    
    setLoading(true);
    setResults(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/fast-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          symbols: selectedStocks,
          methods: selectedMethods,
          buyThresholdMin: parseFloat(buyThresholdMin),
          buyThresholdMax: parseFloat(buyThresholdMax),
          sellThresholdMin: parseFloat(sellThresholdMin),
          sellThresholdMax: parseFloat(sellThresholdMax),
          sessionType,
          conservativePricing,
          slippage: parseFloat(slippage),
          allowShorts
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to run fast daily analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedResults = (data) => {
    if (!data) return [];
    
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    const headers = ['Symbol', 'Method', 'Buy %', 'Sell %', 'Total Return %', 'Avg Return %', 'Trades', 'Win Rate %'];
    const rows = data.map(r => [
      r.symbol,
      r.method,
      r.buyThreshold.toFixed(1),
      r.sellThreshold.toFixed(1),
      r.totalReturn.toFixed(2),
      r.avgReturn.toFixed(2),
      r.tradeCount,
      r.winRate.toFixed(1)
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="fast-daily-container">
      <h1>Fast Daily Report</h1>
      <p className="subtitle">Find the best settings for each stock on a specific day</p>

      <form onSubmit={handleSubmit} className="fast-daily-form">
        <div className="form-section">
          <h3>Date</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="form-section">
          <h3>Stocks</h3>
          <div className="button-group">
            <button type="button" onClick={handleSelectAllStocks}>Select All</button>
            <button type="button" onClick={handleDeselectAllStocks}>Deselect All</button>
          </div>
          <div className="checkbox-grid">
            {STOCKS.map(stock => (
              <label key={stock} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedStocks.includes(stock)}
                  onChange={() => handleStockToggle(stock)}
                />
                {stock}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>Methods</h3>
          <div className="button-group">
            <button type="button" onClick={handleSelectAllMethods}>Select All</button>
            <button type="button" onClick={handleDeselectAllMethods}>Deselect All</button>
          </div>
          <div className="checkbox-grid">
            {METHODS.map(method => (
              <label key={method} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedMethods.includes(method)}
                  onChange={() => handleMethodToggle(method)}
                />
                {method}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-section">
            <h3>Buy Threshold Range (%)</h3>
            <div className="range-inputs">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={buyThresholdMin}
                onChange={(e) => setBuyThresholdMin(e.target.value)}
                placeholder="Min"
              />
              <span>to</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={buyThresholdMax}
                onChange={(e) => setBuyThresholdMax(e.target.value)}
                placeholder="Max"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Sell Threshold Range (%)</h3>
            <div className="range-inputs">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={sellThresholdMin}
                onChange={(e) => setSellThresholdMin(e.target.value)}
                placeholder="Min"
              />
              <span>to</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={sellThresholdMax}
                onChange={(e) => setSellThresholdMax(e.target.value)}
                placeholder="Max"
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-section">
            <h3>Session Type</h3>
            <select value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              {SESSIONS.map(session => (
                <option key={session} value={session}>{session}</option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <h3>Slippage (%)</h3>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </div>
        </div>

        <div className="form-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={conservativePricing}
              onChange={(e) => setConservativePricing(e.target.checked)}
            />
            Conservative Pricing (round up buys, down sells)
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allowShorts}
              onChange={(e) => setAllowShorts(e.target.checked)}
            />
            Allow Short Positions
          </label>
        </div>

        <div className="combinations-info">
          <strong>Total Combinations:</strong> {calculateCombinations().toLocaleString()}
        </div>

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Running Analysis...' : 'Run Fast Daily Analysis'}
        </button>
      </form>

      {results && (
        <div className="results-section">
          <h2>Results for {results.date}</h2>
          <div className="results-summary">
            <div className="summary-card">
              <div className="summary-label">Total Combinations</div>
              <div className="summary-value">{results.totalCombinations.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Valid Results</div>
              <div className="summary-value">{results.validResults.toLocaleString()}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Session Type</div>
              <div className="summary-value">{results.sessionType}</div>
            </div>
          </div>

          {results.overallBest && (
            <div className="overall-best">
              <h3>🏆 Overall Best Settings</h3>
              <div className="best-card">
                <div className="best-row">
                  <span className="best-label">Symbol:</span>
                  <span className="best-value">{results.overallBest.symbol}</span>
                </div>
                <div className="best-row">
                  <span className="best-label">Method:</span>
                  <span className="best-value">{results.overallBest.method}</span>
                </div>
                <div className="best-row">
                  <span className="best-label">Buy Threshold:</span>
                  <span className="best-value">{results.overallBest.buyThreshold.toFixed(1)}%</span>
                </div>
                <div className="best-row">
                  <span className="best-label">Sell Threshold:</span>
                  <span className="best-value">{results.overallBest.sellThreshold.toFixed(1)}%</span>
                </div>
                <div className="best-row">
                  <span className="best-label">Total Return:</span>
                  <span className="best-value highlight">{results.overallBest.totalReturn.toFixed(2)}%</span>
                </div>
                <div className="best-row">
                  <span className="best-label">Trades:</span>
                  <span className="best-value">{results.overallBest.tradeCount}</span>
                </div>
                <div className="best-row">
                  <span className="best-label">Win Rate:</span>
                  <span className="best-value">{results.overallBest.winRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          <div className="best-per-stock">
            <div className="section-header">
              <h3>Best Settings Per Stock</h3>
              <button 
                onClick={() => exportToCSV(results.bestPerStock, `fast-daily-best-per-stock-${results.date}.csv`)}
                className="export-button"
              >
                Export to CSV
              </button>
            </div>
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('symbol')}>
                      Symbol {sortField === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('method')}>
                      Method {sortField === 'method' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('buyThreshold')}>
                      Buy % {sortField === 'buyThreshold' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('sellThreshold')}>
                      Sell % {sortField === 'sellThreshold' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('totalReturn')}>
                      Total Return % {sortField === 'totalReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('avgReturn')}>
                      Avg Return % {sortField === 'avgReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('tradeCount')}>
                      Trades {sortField === 'tradeCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('winRate')}>
                      Win Rate % {sortField === 'winRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedResults(results.bestPerStock).map((result, index) => (
                    <tr key={index}>
                      <td>{result.symbol}</td>
                      <td>{result.method}</td>
                      <td>{result.buyThreshold.toFixed(1)}</td>
                      <td>{result.sellThreshold.toFixed(1)}</td>
                      <td className={result.totalReturn >= 0 ? 'positive' : 'negative'}>
                        {result.totalReturn.toFixed(2)}%
                      </td>
                      <td className={result.avgReturn >= 0 ? 'positive' : 'negative'}>
                        {result.avgReturn.toFixed(2)}%
                      </td>
                      <td>{result.tradeCount}</td>
                      <td>{result.winRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="all-results">
            <div className="section-header">
              <h3>All Results</h3>
              <button 
                onClick={() => exportToCSV(results.allResults, `fast-daily-all-results-${results.date}.csv`)}
                className="export-button"
              >
                Export All to CSV
              </button>
            </div>
            <div className="results-count">
              Showing {results.allResults.length} results
            </div>
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('symbol')}>
                      Symbol {sortField === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('method')}>
                      Method {sortField === 'method' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('buyThreshold')}>
                      Buy % {sortField === 'buyThreshold' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('sellThreshold')}>
                      Sell % {sortField === 'sellThreshold' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('totalReturn')}>
                      Total Return % {sortField === 'totalReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('avgReturn')}>
                      Avg Return % {sortField === 'avgReturn' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('tradeCount')}>
                      Trades {sortField === 'tradeCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('winRate')}>
                      Win Rate % {sortField === 'winRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedResults(results.allResults).map((result, index) => (
                    <tr key={index}>
                      <td>{result.symbol}</td>
                      <td>{result.method}</td>
                      <td>{result.buyThreshold.toFixed(1)}</td>
                      <td>{result.sellThreshold.toFixed(1)}</td>
                      <td className={result.totalReturn >= 0 ? 'positive' : 'negative'}>
                        {result.totalReturn.toFixed(2)}%
                      </td>
                      <td className={result.avgReturn >= 0 ? 'positive' : 'negative'}>
                        {result.avgReturn.toFixed(2)}%
                      </td>
                      <td>{result.tradeCount}</td>
                      <td>{result.winRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FastDaily;