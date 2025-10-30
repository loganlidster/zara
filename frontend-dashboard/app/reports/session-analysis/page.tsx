'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SessionResult {
  symbol: string;
  session: string;
  total_events: number;
  buy_events: number;
  sell_events: number;
  total_return: number;
  total_return_pct: string;
  win_rate_pct: string;
  avg_trade_return_pct: string;
  best_day_return_pct: string;
  worst_day_return_pct: string;
  total_trades: number;
}

interface Summary {
  rth_total_return_pct: string;
  ah_total_return_pct: string;
  rth_win_rate_pct: string;
  ah_win_rate_pct: string;
  recommendation: string;
}

interface ApiResponse {
  success: boolean;
  comparison: SessionResult[];
  summary: Summary;
  error?: string;
}

const AVAILABLE_SYMBOLS = ['RIOT', 'MARA', 'HIVE', 'CIFR', 'CLSK', 'BTDR', 'WULF', 'IREN', 'CORZ', 'BTBT', 'CAN'];
const BASELINE_METHODS = ['VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN', 'EQUAL_MEAN'];

export default function SessionAnalysisPage() {
  // Form state
  const [symbols, setSymbols] = useState<string[]>(['RIOT', 'MARA', 'HIVE']);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [method, setMethod] = useState('VWAP_RATIO');
  const [buyPct, setBuyPct] = useState(1.0);
  const [sellPct, setSellPct] = useState(2.0);
  const [initialCapital, setInitialCapital] = useState(10000);

  // Results state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<SessionResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const toggleSymbol = (symbol: string) => {
    setSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setComparison([]);
    setSummary(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const response = await fetch(`${apiUrl}/api/session-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
          startDate,
          endDate,
          method,
          buyPct,
          sellPct,
          initialCapital
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      setComparison(data.comparison);
      setSummary(data.summary);

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (comparison.length === 0) return;

    const headers = Object.keys(comparison[0]);
    const csvContent = [
      headers.join(','),
      ...comparison.map(row => headers.map(h => row[h as keyof SessionResult]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-analysis-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Prepare chart data
  const getChartData = () => {
    if (comparison.length === 0) return [];

    const symbolGroups: { [key: string]: { RTH?: SessionResult; AH?: SessionResult } } = {};
    
    comparison.forEach(result => {
      if (!symbolGroups[result.symbol]) {
        symbolGroups[result.symbol] = {};
      }
      symbolGroups[result.symbol][result.session as 'RTH' | 'AH'] = result;
    });

    return Object.entries(symbolGroups).map(([symbol, sessions]) => ({
      symbol,
      RTH: sessions.RTH ? parseFloat(sessions.RTH.total_return_pct) : 0,
      AH: sessions.AH ? parseFloat(sessions.AH.total_return_pct) : 0,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Session Analysis</h1>
          <p className="mt-2 text-gray-600">
            Compare RTH (Regular Trading Hours) vs AH (After Hours) performance to optimize your trading schedule.
          </p>
        </div>

        {/* Controls Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
          {/* Symbols Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symbols
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSymbols(AVAILABLE_SYMBOLS)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSymbols([])}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SYMBOLS.map(symbol => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => toggleSymbol(symbol)}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    symbols.includes(symbol)
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range & Method */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                required
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Baseline Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              >
                {BASELINE_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Thresholds & Capital */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buy % (above baseline)
              </label>
              <input
                type="number"
                step="0.1"
                value={buyPct}
                onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sell % (below baseline)
              </label>
              <input
                type="number"
                step="0.1"
                value={sellPct}
                onChange={(e) => setSellPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Capital ($)
              </label>
              <input
                type="number"
                step="100"
                value={initialCapital}
                onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || symbols.length === 0}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Analyzing Sessions...' : 'Compare RTH vs AH'}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {summary && (
          <>
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Summary & Recommendation</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">RTH Avg Return</p>
                  <p className={`text-2xl font-bold ${parseFloat(summary.rth_total_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.rth_total_return_pct}%
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">AH Avg Return</p>
                  <p className={`text-2xl font-bold ${parseFloat(summary.ah_total_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.ah_total_return_pct}%
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">RTH Win Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.rth_win_rate_pct}%</p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">AH Win Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.ah_win_rate_pct}%</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Recommendation:</p>
                <p className="text-gray-900">{summary.recommendation}</p>
              </div>
            </div>

            {/* Chart */}
            {comparison.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Returns Comparison by Symbol</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="symbol" />
                    <YAxis label={{ value: 'Return %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="RTH" fill="#f97316" name="RTH (Regular Hours)" />
                    <Bar dataKey="AH" fill="#fb923c" name="AH (After Hours)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Detailed Results Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Detailed Results ({comparison.length} entries)
                </h2>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Events</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Trade %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best Day %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worst Day %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {comparison.map((result, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded font-medium ${
                            result.session === 'RTH' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {result.session}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.total_events}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.total_trades}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          parseFloat(result.total_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.total_return_pct}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                          {result.win_rate_pct}%
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                          parseFloat(result.avg_trade_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.avg_trade_return_pct}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          {result.best_day_return_pct}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {result.worst_day_return_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing RTH vs AH performance...</p>
          </div>
        )}
      </main>
    </div>
  );
}