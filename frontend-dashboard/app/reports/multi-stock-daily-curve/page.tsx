'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];

// Enhanced color palette for maximum distinction
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

interface StockConfig {
  id: string;
  symbol: string;
  rthMethod: string;
  ahMethod: string;
  rthBuyPct: number;
  rthSellPct: number;
  ahBuyPct: number;
  ahSellPct: number;
  enabled: boolean;
}

interface StockResult {
  symbol: string;
  rthMethod: string;
  ahMethod: string;
  dates: string[];
  equityCurve: number[];
  summary: {
    totalReturn: number;
    totalReturnPct: number;
    totalTrades: number;
    winRate: number;
    avgTrade: number;
    finalEquity: number;
  };
}

interface ApiResponse {
  success: boolean;
  dateRange: { startDate: string; endDate: string };
  results: StockResult[];
  errors?: { symbol: string; error: string }[];
}

export default function MultiStockDailyCurve() {
  // Set default dates: today and 7 days ago
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  const [startDate, setStartDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [slippagePct, setSlippagePct] = useState(0.1);
  const [conservativeRounding, setConservativeRounding] = useState(true);
  
  const [stocks, setStocks] = useState<StockConfig[]>([
    { id: '1', symbol: 'HIVE', rthMethod: 'EQUAL_MEAN', ahMethod: 'EQUAL_MEAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
    { id: '2', symbol: 'RIOT', rthMethod: 'EQUAL_MEAN', ahMethod: 'EQUAL_MEAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
    { id: '3', symbol: 'MARA', rthMethod: 'EQUAL_MEAN', ahMethod: 'EQUAL_MEAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
  ]);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStock = () => {
    const newId = (Math.max(...stocks.map(s => parseInt(s.id)), 0) + 1).toString();
    setStocks([...stocks, {
      id: newId,
      symbol: 'HIVE',
      rthMethod: 'EQUAL_MEAN',
      ahMethod: 'EQUAL_MEAN',
      rthBuyPct: 0.5,
      rthSellPct: 0.5,
      ahBuyPct: 0.5,
      ahSellPct: 0.5,
      enabled: true
    }]);
  };

  const removeStock = (id: string) => {
    setStocks(stocks.filter(s => s.id !== id));
  };

  const updateStock = (id: string, field: keyof StockConfig, value: any) => {
    setStocks(stocks.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const loadLiveSettings = () => {
    // Example preset - user can customize this
    setStocks([
      { id: '1', symbol: 'BTDR', rthMethod: 'WEIGHTED_MEDIAN', ahMethod: 'WEIGHTED_MEDIAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '2', symbol: 'RIOT', rthMethod: 'EQUAL_MEAN', ahMethod: 'EQUAL_MEAN', rthBuyPct: 0.6, rthSellPct: 0.4, ahBuyPct: 0.7, ahSellPct: 0.3, enabled: true },
      { id: '3', symbol: 'MARA', rthMethod: 'VWAP_RATIO', ahMethod: 'VWAP_RATIO', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.6, ahSellPct: 0.4, enabled: true },
      { id: '4', symbol: 'CLSK', rthMethod: 'VOL_WEIGHTED', ahMethod: 'VOL_WEIGHTED', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '5', symbol: 'CORZ', rthMethod: 'WINSORIZED', ahMethod: 'WINSORIZED', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '6', symbol: 'HUT', rthMethod: 'EQUAL_MEAN', ahMethod: 'EQUAL_MEAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '7', symbol: 'CAN', rthMethod: 'VWAP_RATIO', ahMethod: 'VWAP_RATIO', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '8', symbol: 'CIFR', rthMethod: 'WEIGHTED_MEDIAN', ahMethod: 'WEIGHTED_MEDIAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '9', symbol: 'HIVE', rthMethod: 'EQUAL_MEAN', ahMethod: 'EQUAL_MEAN', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '10', symbol: 'APLD', rthMethod: 'VOL_WEIGHTED', ahMethod: 'VOL_WEIGHTED', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
      { id: '11', symbol: 'WULF', rthMethod: 'WINSORIZED', ahMethod: 'WINSORIZED', rthBuyPct: 0.5, rthSellPct: 0.5, ahBuyPct: 0.5, ahSellPct: 0.5, enabled: true },
    ]);
  };

  const selectAll = () => {
    setStocks(stocks.map(s => ({ ...s, enabled: true })));
  };

  const deselectAll = () => {
    setStocks(stocks.map(s => ({ ...s, enabled: false })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const enabledStocks = stocks.filter(s => s.enabled);
    if (enabledStocks.length === 0) {
      setError('Please enable at least one stock');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const response = await fetch(`${API_URL}/api/multi-stock-daily-curve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          slippagePct,
          conservativeRounding,
          stocks: enabledStocks.map(s => ({
            symbol: s.symbol,
            rthMethod: s.rthMethod,
            ahMethod: s.ahMethod,
            rthBuyPct: s.rthBuyPct,
            rthSellPct: s.rthSellPct,
            ahBuyPct: s.ahBuyPct,
            ahSellPct: s.ahSellPct
          }))
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = data?.results.length ? (() => {
    const allDates = new Set<string>();
    data.results.forEach(result => {
      result.dates.forEach(date => allDates.add(date));
    });

    const sortedDates = Array.from(allDates).sort();
    
    return sortedDates.map(date => {
      const point: any = { date };
      data.results.forEach(result => {
        const idx = result.dates.indexOf(date);
        if (idx !== -1) {
          const returnPct = ((result.equityCurve[idx] - 10000) / 10000) * 100;
          point[`${result.symbol}`] = returnPct;
        }
      });
      return point;
    });
  })() : [];

  const exportCSV = () => {
    if (!data?.results) return;

    const headers = ['Symbol', 'RTH Method', 'AH Method', 'Total Return %', 'Total Trades', 'Win Rate %', 'Avg Trade %', 'Final Equity'];
    const rows = data.results.map(r => [
      r.symbol,
      r.rthMethod,
      r.ahMethod,
      r.summary.totalReturnPct.toFixed(2),
      r.summary.totalTrades,
      r.summary.winRate.toFixed(2),
      r.summary.avgTrade.toFixed(2),
      r.summary.finalEquity.toFixed(2)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-stock-daily-curve-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Multi-Stock Daily Curve</h1>
          <p className="mt-2 text-gray-600">
            Run Daily Curve simulation for multiple stocks simultaneously, each with independent settings and $10,000 starting capital
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Global Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Slippage %</label>
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
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={conservativeRounding}
                      onChange={(e) => setConservativeRounding(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Conservative Rounding</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Stock Configurations */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Stock Configurations</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={loadLiveSettings}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Load Live Settings
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {stocks.map((stock, index) => (
                  <div key={stock.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={stock.enabled}
                        onChange={(e) => updateStock(stock.id, 'enabled', e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-8 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Symbol</label>
                          <select
                            value={stock.symbol}
                            onChange={(e) => updateStock(stock.id, 'symbol', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">RTH Method</label>
                          <select
                            value={stock.rthMethod}
                            onChange={(e) => updateStock(stock.id, 'rthMethod', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">AH Method</label>
                          <select
                            value={stock.ahMethod}
                            onChange={(e) => updateStock(stock.id, 'ahMethod', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">RTH Buy %</label>
                          <input
                            type="number"
                            value={stock.rthBuyPct}
                            onChange={(e) => updateStock(stock.id, 'rthBuyPct', parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">RTH Sell %</label>
                          <input
                            type="number"
                            value={stock.rthSellPct}
                            onChange={(e) => updateStock(stock.id, 'rthSellPct', parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">AH Buy %</label>
                          <input
                            type="number"
                            value={stock.ahBuyPct}
                            onChange={(e) => updateStock(stock.id, 'ahBuyPct', parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">AH Sell %</label>
                          <input
                            type="number"
                            value={stock.ahSellPct}
                            onChange={(e) => updateStock(stock.id, 'ahSellPct', parseFloat(e.target.value))}
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeStock(stock.id)}
                        className="mt-5 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addStock}
                className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium"
              >
                + Add Stock
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || stocks.filter(s => s.enabled).length === 0}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Running Simulations...' : 'Run Simulation'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {data && data.results.length > 0 && (
          <div className="space-y-8">
            {/* Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Combined Performance</h2>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    label={{ value: 'Return (%)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                  />
                  <Tooltip 
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value: any) => value !== null ? `${value.toFixed(2)}%` : 'N/A'}
                  />
                  <Legend />
                  {data.results.map((result, i) => (
                    <Line
                      key={result.symbol}
                      type="monotone"
                      dataKey={result.symbol}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={i < 5 ? 2.5 : 2}
                      dot={false}
                      connectNulls
                      strokeDasharray={i >= 10 ? "5 5" : undefined}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Table */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Summary Statistics</h2>
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  Export CSV
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RTH Method</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AH Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Return %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Trades</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Trade %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Equity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.results
                      .sort((a, b) => b.summary.totalReturnPct - a.summary.totalReturnPct)
                      .map((result) => (
                        <tr key={result.symbol}>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{result.symbol}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.rthMethod}</td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.ahMethod}</td>
                          <td className={`px-6 py-4 whitespace-nowrap font-semibold ${result.summary.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {result.summary.totalReturnPct.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{result.summary.totalTrades}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{result.summary.winRate.toFixed(1)}%</td>
                          <td className={`px-6 py-4 whitespace-nowrap ${result.summary.avgTrade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {result.summary.avgTrade.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">${result.summary.finalEquity.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Errors */}
            {data.errors && data.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">Warnings</h3>
                <ul className="list-disc list-inside space-y-1">
                  {data.errors.map((err, i) => (
                    <li key={i} className="text-yellow-800">
                      {err.symbol}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}