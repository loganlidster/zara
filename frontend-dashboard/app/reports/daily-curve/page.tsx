'use client';

import { useState } from 'react';
import { getDailyCurve, DailyCurveResponse } from '@/lib/api';
import Header from '@/components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

// Color palette for symbols
const COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
  '#06B6D4', // cyan
];

const BTC_COLOR = '#F7931A'; // Bitcoin orange

export default function DailyCurveReport() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['HIVE', 'RIOT', 'MARA']);
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [session, setSession] = useState('RTH');
  const [buyPct, setBuyPct] = useState(2.9);
  const [sellPct, setSellPct] = useState(0.7);
  const [rthBuyPct, setRthBuyPct] = useState(2.9);
  const [rthSellPct, setRthSellPct] = useState(0.7);
  const [ahBuyPct, setAhBuyPct] = useState(2.9);
  const [ahSellPct, setAhSellPct] = useState(0.7);
  const [useSameValues, setUseSameValues] = useState(true);
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-22');
  const [alignmentMode, setAlignmentMode] = useState('union');
  const [includeBtc, setIncludeBtc] = useState(true);
  const [slippagePct, setSlippagePct] = useState(0.1);
  const [conservativeRounding, setConservativeRounding] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DailyCurveResponse | null>(null);

  const handleSymbolToggle = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSymbols.length === 0) {
      setError('Please select at least one symbol');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getDailyCurve({
        symbols: selectedSymbols,
        method,
        session,
        buyPct,
        sellPct,
        startDate,
        endDate,
        alignmentMode,
        includeBtc,
        slippagePct,
        conservativeRounding
      });
      
      setData(response);
    } catch (err: any) {
      console.error('Error fetching daily curve:', err);
      setError(err.message || 'Failed to fetch daily curve data');
    } finally {
      setLoading(false);
    }
  };

  // Transform data for Recharts
  const chartData = data ? data.data.dates.map((date, i) => {
    const point: any = { date };
    
    // Add each symbol's ROI
    for (const symbol of Object.keys(data.data.series)) {
      point[symbol] = data.data.series[symbol][i];
    }
    
    return point;
  }) : [];

  const exportToCSV = () => {
    if (!data) return;
    
    const headers = ['Date', ...Object.keys(data.data.series)];
    const rows = data.data.dates.map((date, i) => {
      const row = [date];
      for (const symbol of Object.keys(data.data.series)) {
        const value = data.data.series[symbol][i];
        row.push(value !== null ? value.toFixed(2) : '');
      }
      return row.join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-curve-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Curve & ROI</h1>
              <a
                href="/"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Back to Home
              </a>
            </div>
        <p className="text-gray-600 mb-8">Multi-symbol performance comparison with BTC benchmark</p>

        {/* Filters */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Symbol Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Symbols (click to toggle)
            </label>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => handleSymbolToggle(symbol)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    selectedSymbols.includes(symbol)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Selected: {selectedSymbols.length > 0 ? selectedSymbols.join(', ') : 'None'}
            </p>
          </div>

          {/* Strategy Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {SESSIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buy %</label>
              <input
                type="number"
                value={buyPct}
                onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                step="0.1"
                min="0"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sell %</label>
              <input
                type="number"
                value={sellPct}
                onChange={(e) => setSellPct(parseFloat(e.target.value))}
                step="0.1"
                min="0"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>


            {/* Separate RTH/AH Settings (when session is ALL) */}
            {session === 'ALL' && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="useSameValues"
                    checked={useSameValues}
                    onChange={(e) => setUseSameValues(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="useSameValues" className="text-sm font-medium text-gray-700">
                    Use same values for RTH and AH
                  </label>
                </div>

                {!useSameValues && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-3">RTH (Regular Trading Hours)</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buy %</label>
                          <input
                            type="number"
                            value={rthBuyPct}
                            onChange={(e) => setRthBuyPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sell %</label>
                          <input
                            type="number"
                            value={rthSellPct}
                            onChange={(e) => setRthSellPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-900 mb-3">AH (After Hours)</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buy %</label>
                          <input
                            type="number"
                            value={ahBuyPct}
                            onChange={(e) => setAhBuyPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sell %</label>
                          <input
                            type="number"
                            value={ahSellPct}
                            onChange={(e) => setAhSellPct(parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Alignment Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="union"
                    checked={alignmentMode === 'union'}
                    onChange={(e) => setAlignmentMode(e.target.value)}
                    className="mr-2"
                  />
                  Union (any symbol)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="intersection"
                    checked={alignmentMode === 'intersection'}
                    onChange={(e) => setAlignmentMode(e.target.value)}
                    className="mr-2"
                  />
                  Intersection (all symbols)
                </label>
              </div>
            </div>
            
            <div>
              <label className="flex items-center pt-7">
                <input
                  type="checkbox"
                  checked={includeBtc}
                  onChange={(e) => setIncludeBtc(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Include BTC Benchmark</span>
              </label>
            </div>
          </div>


             {/* Slippage & Conservative Rounding */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Slippage (%)
                 </label>
                 <input
                   type="number"
                   step="0.1"
                   min="0"
                   max="5"
                   value={slippagePct}
                   onChange={(e) => setSlippagePct(parseFloat(e.target.value))}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                 />
                 <p className="mt-1 text-xs text-gray-500">
                   Simulates price impact (0-5%, default 0.1%)
                 </p>
               </div>

               <div>
                 <label className="flex items-center pt-7">
                   <input
                     type="checkbox"
                     checked={conservativeRounding}
                     onChange={(e) => setConservativeRounding(e.target.checked)}
                     className="mr-2"
                   />
                   <span className="text-sm font-medium text-gray-700">
                     Conservative Rounding
                   </span>
                 </label>
                 <p className="mt-1 text-xs text-gray-500 ml-6">
                   Round up for buys, down for sells (more realistic)
                 </p>
               </div>
             </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || selectedSymbols.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Generate Chart'}
            </button>
            
            {data && (
              <button
                type="button"
                onClick={exportToCSV}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Export CSV
              </button>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Timing */}
        {data && data.timing && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-8">
            <div className="flex items-center justify-between">
              <div>
                <strong>Performance:</strong> Generated in {(data.timing.total / 1000).toFixed(2)}s
              </div>
              <div className="text-sm">
                Processed {data.timing.symbolsProcessed} symbols
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        {data && chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cumulative Returns</h2>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  label={{ value: 'Cumulative Return (%)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value: any) => value !== null ? `${value.toFixed(2)}%` : 'N/A'}
                />
                <Legend />
                {selectedSymbols.map((symbol, i) => (
                  <Line 
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
                {includeBtc && data.data.series['BTC'] && (
                  <Line 
                    type="monotone"
                    dataKey="BTC"
                    stroke={BTC_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Metrics Table */}
        {data && data.metrics && data.metrics.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <h2 className="text-xl font-bold text-gray-900 p-6 pb-4">Summary Metrics</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Return</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Trades</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Drawdown</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Equity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.metrics.map((metric) => (
                    <tr key={metric.symbol}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {metric.symbol}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        metric.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.totalReturn.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {metric.totalTrades}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {metric.maxDrawdown.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${metric.finalEquity.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}