'use client';

import { useState } from 'react';
import { getDailyCurve, DailyCurveResponse } from '@/lib/api';
import Header from '@/components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

// Enhanced color palette for maximum distinction
// Optimized for visual separation and colorblind accessibility
const COLORS = [
  '#EF4444', // bright red
  '#3B82F6', // bright blue
  '#10B981', // emerald green
  '#F59E0B', // amber/gold
  '#8B5CF6', // purple
  '#EC4899', // hot pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime green
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#A855F7', // bright purple
  '#FB923C', // light orange
  '#4ADE80', // light green
  '#F472B6', // light pink
];

const BTC_COLOR = '#F7931A'; // Bitcoin orange

export default function DailyCurveReport() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['HIVE', 'RIOT', 'MARA']);
  const [method, setMethod] = useState('EQUAL_MEAN');
  const [session, setSession] = useState('RTH');
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-31');
  const [buyPct, setBuyPct] = useState(0.5);
  const [sellPct, setSellPct] = useState(0.5);
  const [rthBuyPct, setRthBuyPct] = useState(0.5);
  const [rthSellPct, setRthSellPct] = useState(0.5);
  const [ahBuyPct, setAhBuyPct] = useState(0.5);
  const [ahSellPct, setAhSellPct] = useState(0.5);
  const [slippagePct, setSlippagePct] = useState(0.1);
  const [conservativeRounding, setConservativeRounding] = useState(true);
  const [includeBtc, setIncludeBtc] = useState(false);
  const [data, setData] = useState<DailyCurveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSymbolToggle = (symbol: string) => {
    setSelectedSymbols(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleSelectAll = () => {
    setSelectedSymbols([...SYMBOLS]);
  };

  const handleClearAll = () => {
    setSelectedSymbols([]);
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
      const params: any = {
        symbols: selectedSymbols,
        method,
        session,
        startDate,
        endDate,
        slippagePct,
        conservativeRounding,
      };

      // Add session-specific thresholds for ALL mode
      if (session === 'ALL') {
        params.rthBuyPct = rthBuyPct;
        params.rthSellPct = rthSellPct;
        params.ahBuyPct = ahBuyPct;
        params.ahSellPct = ahSellPct;
      } else {
        params.buyPct = buyPct;
        params.sellPct = sellPct;
      }

      const result = await getDailyCurve(params);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = data?.data?.dates.map((date: string) => {
    const point: any = { date };
    selectedSymbols.forEach(symbol => {
      const series = data.data.series[symbol];
      if (series) {
        const idx = data.data.dates.indexOf(date);
        point[symbol] = series[idx];
      }
    });
    if (includeBtc && data.data.series['BTC']) {
      const idx = data.data.dates.indexOf(date);
      point['BTC'] = data.data.series['BTC'][idx];
    }
    return point;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Daily Curve Report</h1>
          <p className="mt-2 text-gray-600">
            Track cumulative returns over time for multiple symbols using event-based trading strategies
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Selected: {selectedSymbols.length > 0 ? selectedSymbols.join(', ') : 'None'}
              </p>
            </div>

            {/* Strategy Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Baseline Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session
                </label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SESSIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slippage %
                </label>
                <input
                  type="number"
                  value={slippagePct}
                  onChange={(e) => setSlippagePct(parseFloat(e.target.value))}
                  step="0.1"
                  min="0"
                  max="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Threshold Controls */}
            {session === 'ALL' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-md">
                  <h3 className="font-medium text-blue-900 mb-3">RTH (Regular Trading Hours) Thresholds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        RTH Buy % (default: 0.5%)
                      </label>
                      <input
                        type="number"
                        value={rthBuyPct}
                        onChange={(e) => setRthBuyPct(parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        RTH Sell % (default: 0.5%)
                      </label>
                      <input
                        type="number"
                        value={rthSellPct}
                        onChange={(e) => setRthSellPct(parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-md">
                  <h3 className="font-medium text-purple-900 mb-3">AH (After Hours) Thresholds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AH Buy % (default: 0.5%)
                      </label>
                      <input
                        type="number"
                        value={ahBuyPct}
                        onChange={(e) => setAhBuyPct(parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AH Sell % (default: 0.5%)
                      </label>
                      <input
                        type="number"
                        value={ahSellPct}
                        onChange={(e) => setAhSellPct(parseFloat(e.target.value))}
                        step="0.1"
                        min="0"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buy Threshold % (default: 0.5%)
                  </label>
                  <input
                    type="number"
                    value={buyPct}
                    onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                    step="0.1"
                    min="0"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sell Threshold % (default: 0.5%)
                  </label>
                  <input
                    type="number"
                    value={sellPct}
                    onChange={(e) => setSellPct(parseFloat(e.target.value))}
                    step="0.1"
                    min="0"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Additional Options */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={conservativeRounding}
                  onChange={(e) => setConservativeRounding(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Conservative Rounding (rounds up for buys, down for sells)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeBtc}
                  onChange={(e) => setIncludeBtc(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include BTC</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || selectedSymbols.length === 0}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {data && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Cumulative Returns</h2>
            
            <div className="mb-8">
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
                      strokeWidth={i < 5 ? 2.5 : 2}
                      dot={false}
                      connectNulls
                      strokeDasharray={i >= 10 ? "5 5" : undefined}
                    />
                  ))}
                  {includeBtc && data.data.series['BTC'] && (
                    <Line 
                      type="monotone"
                      dataKey="BTC"
                      stroke={BTC_COLOR}
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Statistics */}
            {data.data.summary && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Summary Statistics</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Return %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Trades</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Trade %</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(data.data.summary).map(([symbol, stats]: [string, any]) => (
                        <tr key={symbol}>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{symbol}</td>
                          <td className={`px-6 py-4 whitespace-nowrap ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.totalReturn.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{stats.totalTrades}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{stats.winRate.toFixed(1)}%</td>
                          <td className={`px-6 py-4 whitespace-nowrap ${stats.avgTrade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {stats.avgTrade.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}