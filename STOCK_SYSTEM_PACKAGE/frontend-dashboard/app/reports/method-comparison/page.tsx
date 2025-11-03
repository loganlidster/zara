'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface MethodResult {
  symbol: string;
  method: string;
  total_events: number;
  total_trades: number;
  total_return: number;
  total_return_pct: string;
  win_rate_pct: string;
  avg_trade_return_pct: string;
  final_equity: string;
}

interface MethodRanking {
  method: string;
  avg_return_pct: string;
  win_rate_pct: string;
}

interface Summary {
  best_method: string;
  best_method_return_pct: string;
  method_rankings: MethodRanking[];
}

interface ApiResponse {
  success: boolean;
  comparison: MethodResult[];
  summary: Summary;
  error?: string;
}

const AVAILABLE_SYMBOLS = ['RIOT', 'MARA', 'HIVE', 'CIFR', 'CLSK', 'BTDR', 'WULF', 'IREN', 'CORZ', 'BTBT', 'CAN'];

export default function MethodComparisonPage() {
  // Form state
  const [symbols, setSymbols] = useState<string[]>(['RIOT', 'MARA', 'HIVE']);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [sessionType, setSessionType] = useState('RTH');
  const [buyPct, setBuyPct] = useState(1.0);
  const [sellPct, setSellPct] = useState(2.0);
  const [initialCapital, setInitialCapital] = useState(10000);

  // Results state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<MethodResult[]>([]);
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
      const response = await fetch(`${apiUrl}/api/method-comparison`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
          startDate,
          endDate,
          sessionType,
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
      ...comparison.map(row => headers.map(h => row[h as keyof MethodResult]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `method-comparison-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Prepare chart data
  const getBarChartData = () => {
    if (!summary) return [];
    return summary.method_rankings.map(ranking => ({
      method: ranking.method,
      'Avg Return %': parseFloat(ranking.avg_return_pct),
      'Win Rate %': parseFloat(ranking.win_rate_pct)
    }));
  };

  const getRadarChartData = () => {
    if (!summary) return [];
    return summary.method_rankings.map(ranking => ({
      method: ranking.method.replace('_', ' '),
      return: parseFloat(ranking.avg_return_pct),
      winRate: parseFloat(ranking.win_rate_pct)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Method Comparison</h1>
          <p className="mt-2 text-gray-600">
            Compare all 5 baseline methods side-by-side to find the best strategy for your trading.
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
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range & Session */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Type
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="RTH">RTH (Regular Trading Hours)</option>
                <option value="AH">AH (After Hours)</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || symbols.length === 0}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Comparing Methods...' : 'Compare All Methods'}
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
            {/* Winner Card */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🏆 Best Method</h2>
              <div className="bg-white rounded-lg p-6">
                <p className="text-4xl font-bold text-purple-600 mb-2">{summary.best_method}</p>
                <p className="text-xl text-gray-700">
                  Average Return: <span className="font-bold text-green-600">{summary.best_method_return_pct}%</span>
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Bar Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Method Rankings</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getBarChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="method" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Avg Return %" fill="#9333ea" />
                    <Bar dataKey="Win Rate %" fill="#a855f7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Radar</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={getRadarChartData()}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="method" />
                    <PolarRadiusAxis />
                    <Radar name="Return %" dataKey="return" stroke="#9333ea" fill="#9333ea" fillOpacity={0.6} />
                    <Radar name="Win Rate %" dataKey="winRate" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Method Rankings Table */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Method Rankings</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Return %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.method_rankings.map((ranking, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-purple-50' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {ranking.method}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                          parseFloat(ranking.avg_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {ranking.avg_return_pct}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {ranking.win_rate_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Trade %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Final Equity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {comparison.map((result, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.method}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${result.final_equity}
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Comparing all 5 baseline methods...</p>
          </div>
        )}
      </main>
    </div>
  );
}