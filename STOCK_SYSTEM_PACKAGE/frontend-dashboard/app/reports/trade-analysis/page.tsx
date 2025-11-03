'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Trade {
  trade_number: number;
  entry_date: string;
  entry_time: string;
  entry_price: string;
  exit_date: string;
  exit_time: string;
  exit_price: string;
  shares: number;
  profit_loss: string;
  profit_loss_pct: string;
  duration_minutes: number;
}

interface Statistics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: string;
  total_return_pct: string;
  avg_win_pct: string;
  avg_loss_pct: string;
  largest_win_pct: string;
  largest_loss_pct: string;
  profit_factor: string;
  avg_trade_duration_minutes: number;
  longest_winning_streak: number;
  longest_losing_streak: number;
}

interface ProfitDistribution {
  range: string;
  count: number;
}

interface DailyPerformance {
  date: string;
  trades: number;
  profit_loss_pct: string;
}

interface ApiResponse {
  success: boolean;
  statistics: Statistics;
  trades: Trade[];
  profitDistribution: ProfitDistribution[];
  dailyPerformance: DailyPerformance[];
  error?: string;
}

const AVAILABLE_SYMBOLS = ['RIOT', 'MARA', 'HIVE', 'CIFR', 'CLSK', 'BTDR', 'WULF', 'IREN', 'CORZ', 'BTBT', 'CAN'];
const BASELINE_METHODS = ['VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN', 'EQUAL_MEAN'];

export default function TradeAnalysisPage() {
  // Form state
  const [symbol, setSymbol] = useState('RIOT');
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [method, setMethod] = useState('VWAP_RATIO');
  const [sessionType, setSessionType] = useState('RTH');
  const [buyPct, setBuyPct] = useState(1.0);
  const [sellPct, setSellPct] = useState(2.0);
  const [initialCapital, setInitialCapital] = useState(10000);

  // Results state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [profitDistribution, setProfitDistribution] = useState<ProfitDistribution[]>([]);
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatistics(null);
    setTrades([]);
    setProfitDistribution([]);
    setDailyPerformance([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const response = await fetch(`${apiUrl}/api/trade-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          startDate,
          endDate,
          method,
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

      setStatistics(data.statistics);
      setTrades(data.trades);
      setProfitDistribution(data.profitDistribution);
      setDailyPerformance(data.dailyPerformance);

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (trades.length === 0) return;

    const headers = Object.keys(trades[0]);
    const csvContent = [
      headers.join(','),
      ...trades.map(row => headers.map(h => row[h as keyof Trade]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-analysis-${symbol}-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Trade Analysis</h1>
          <p className="mt-2 text-gray-600">
            Deep dive into trade statistics, win rates, and profit distribution for detailed performance insights.
          </p>
        </div>

        {/* Controls Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                {AVAILABLE_SYMBOLS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                {BASELINE_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              >
                <option value="RTH">RTH</option>
                <option value="AH">AH</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Capital
              </label>
              <input
                type="number"
                step="100"
                value={initialCapital}
                onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buy %
              </label>
              <input
                type="number"
                step="0.1"
                value={buyPct}
                onChange={(e) => setBuyPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sell %
              </label>
              <input
                type="number"
                step="0.1"
                value={sellPct}
                onChange={(e) => setSellPct(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Analyzing Trades...' : 'Analyze Trades'}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {statistics && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-1">Total Trades</p>
                <p className="text-3xl font-bold text-gray-900">{statistics.total_trades}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                <p className="text-3xl font-bold text-blue-600">{statistics.win_rate_pct}%</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-1">Total Return</p>
                <p className={`text-3xl font-bold ${parseFloat(statistics.total_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {statistics.total_return_pct}%
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-1">Profit Factor</p>
                <p className="text-3xl font-bold text-purple-600">{statistics.profit_factor}</p>
              </div>
            </div>

            {/* Detailed Statistics */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600">Winning Trades</p>
                  <p className="text-xl font-semibold text-green-600">{statistics.winning_trades}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Losing Trades</p>
                  <p className="text-xl font-semibold text-red-600">{statistics.losing_trades}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Win</p>
                  <p className="text-xl font-semibold text-green-600">{statistics.avg_win_pct}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Loss</p>
                  <p className="text-xl font-semibold text-red-600">{statistics.avg_loss_pct}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Largest Win</p>
                  <p className="text-xl font-semibold text-green-600">{statistics.largest_win_pct}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Largest Loss</p>
                  <p className="text-xl font-semibold text-red-600">{statistics.largest_loss_pct}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Duration</p>
                  <p className="text-xl font-semibold text-gray-900">{statistics.avg_trade_duration_minutes} min</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Longest Win Streak</p>
                  <p className="text-xl font-semibold text-green-600">{statistics.longest_winning_streak}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Longest Loss Streak</p>
                  <p className="text-xl font-semibold text-red-600">{statistics.longest_losing_streak}</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Profit Distribution */}
              {profitDistribution.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit Distribution</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={profitDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily Performance */}
              {dailyPerformance.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Performance</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="profit_loss_pct" stroke="#ef4444" name="P&L %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Trades Table */}
            {trades.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    All Trades ({trades.length})
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shares</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P&L</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P&L %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {trades.map((trade) => (
                        <tr key={trade.trade_number} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.trade_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.entry_date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${trade.entry_price}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.exit_date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${trade.exit_price}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.shares}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            parseFloat(trade.profit_loss) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${trade.profit_loss}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                            parseFloat(trade.profit_loss_pct) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trade.profit_loss_pct}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.duration_minutes}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing all trades...</p>
          </div>
        )}
      </main>
    </div>
  );
}