'use client';

import { useState } from 'react';
import Header from '@/app/components/Header';

interface DailyWinner {
  symbol: string;
  et_date: string;
  method: string;
  buy_pct: number;
  sell_pct: number;
  day_return: number;
  day_return_pct: string;
  n_trades: number;
  final_equity: string;
}

interface MethodConsistency {
  symbol: string;
  method: string;
  wins: number;
  total_days: number;
  win_rate_pct: string;
  avg_return_pct: string;
}

interface ApiResponse {
  success: boolean;
  dailyWinners: DailyWinner[];
  methodConsistency: MethodConsistency[];
  error?: string;
}

const AVAILABLE_SYMBOLS = ['RIOT', 'MARA', 'HIVE', 'CIFR', 'CLSK', 'BTDR', 'WULF', 'IREN', 'CORZ', 'BTBT', 'CAN'];
const BASELINE_METHODS = ['VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN', 'EQUAL_MEAN'];

export default function BaselineLabFastPage() {
  // Form state
  const [symbols, setSymbols] = useState<string[]>(['RIOT', 'MARA', 'HIVE']);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-29');
  const [methods, setMethods] = useState<string[]>(['VWAP_RATIO', 'WINSORIZED', 'VOL_WEIGHTED']);
  const [sessionType, setSessionType] = useState('RTH');
  const [buyStart, setBuyStart] = useState(0.5);
  const [buyEnd, setBuyEnd] = useState(2.0);
  const [buyStep, setBuyStep] = useState(0.5);
  const [sellStart, setSellStart] = useState(1.0);
  const [sellEnd, setSellEnd] = useState(4.0);
  const [sellStep, setSellStep] = useState(0.5);
  const [initialCapital, setInitialCapital] = useState(10000);

  // Results state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyWinners, setDailyWinners] = useState<DailyWinner[]>([]);
  const [methodConsistency, setMethodConsistency] = useState<MethodConsistency[]>([]);

  // Sort state for tables
  const [winnersSortField, setWinnersSortField] = useState<keyof DailyWinner>('et_date');
  const [winnersSortAsc, setWinnersSortAsc] = useState(true);
  const [consistencySortField, setConsistencySortField] = useState<keyof MethodConsistency>('win_rate_pct');
  const [consistencySortAsc, setConsistencySortAsc] = useState(false);

  const toggleSymbol = (symbol: string) => {
    setSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const toggleMethod = (method: string) => {
    setMethods(prev =>
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const generateThresholds = (start: number, end: number, step: number): number[] => {
    const thresholds: number[] = [];
    for (let val = start; val <= end + 0.001; val += step) {
      thresholds.push(Math.round(val * 10) / 10);
    }
    return thresholds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDailyWinners([]);
    setMethodConsistency([]);

    try {
      const buyPcts = generateThresholds(buyStart, buyEnd, buyStep);
      const sellPcts = generateThresholds(sellStart, sellEnd, sellStep);

      console.log('Submitting request:', {
        symbols,
        startDate,
        endDate,
        methods,
        sessionType,
        buyPcts,
        sellPcts,
        initialCapital
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const response = await fetch(`${apiUrl}/api/baseline-lab-fast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
          startDate,
          endDate,
          methods,
          sessionType,
          buyPcts,
          sellPcts,
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

      setDailyWinners(data.dailyWinners);
      setMethodConsistency(data.methodConsistency);

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const sortWinners = (field: keyof DailyWinner) => {
    if (winnersSortField === field) {
      setWinnersSortAsc(!winnersSortAsc);
    } else {
      setWinnersSortField(field);
      setWinnersSortAsc(true);
    }
  };

  const sortConsistency = (field: keyof MethodConsistency) => {
    if (consistencySortField === field) {
      setConsistencySortAsc(!consistencySortAsc);
    } else {
      setConsistencySortField(field);
      setConsistencySortAsc(true);
    }
  };

  const getSortedWinners = () => {
    return [...dailyWinners].sort((a, b) => {
      const aVal = a[winnersSortField];
      const bVal = b[winnersSortField];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return winnersSortAsc ? comparison : -comparison;
    });
  };

  const getSortedConsistency = () => {
    return [...methodConsistency].sort((a, b) => {
      const aVal = a[consistencySortField];
      const bVal = b[consistencySortField];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return consistencySortAsc ? comparison : -comparison;
    });
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Baseline Lab — FAST</h1>
          <p className="mt-2 text-gray-600">
            Find the best performing method and thresholds for each trading day. 
            Discover which strategies work best on specific days and track method consistency.
          </p>
        </div>

        {/* Controls Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8">
          {/* Symbols Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symbols
            </label>
            <div className="flex flex-wrap gap-2">
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
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABLE_SYMBOLS.map(symbol => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => toggleSymbol(symbol)}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    symbols.includes(symbol)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Methods Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Baseline Methods
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMethods(BASELINE_METHODS)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setMethods([])}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Clear All
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {BASELINE_METHODS.map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    methods.includes(method)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Session Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Type
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="RTH">RTH (Regular Trading Hours)</option>
              <option value="AH">AH (After Hours)</option>
              <option value="ALL">ALL (Both Sessions)</option>
            </select>
          </div>

          {/* Threshold Ranges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Buy Thresholds (%)</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input
                    type="number"
                    step="0.1"
                    value={buyStart}
                    onChange={(e) => setBuyStart(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input
                    type="number"
                    step="0.1"
                    value={buyEnd}
                    onChange={(e) => setBuyEnd(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Step</label>
                  <input
                    type="number"
                    step="0.1"
                    value={buyStep}
                    onChange={(e) => setBuyStep(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Sell Thresholds (%)</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sellStart}
                    onChange={(e) => setSellStart(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sellEnd}
                    onChange={(e) => setSellEnd(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Step</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sellStep}
                    onChange={(e) => setSellStep(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Initial Capital */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Capital ($)
            </label>
            <input
              type="number"
              step="100"
              value={initialCapital}
              onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || symbols.length === 0 || methods.length === 0}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Processing...' : 'Find Best Strategies Per Day'}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {dailyWinners.length > 0 && (
          <>
            {/* Daily Winners Table */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Daily Winners ({dailyWinners.length} days)
                </h2>
                <button
                  onClick={() => exportToCSV(dailyWinners, `baseline-lab-fast-daily-${startDate}-${endDate}.csv`)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th onClick={() => sortWinners('symbol')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Symbol {winnersSortField === 'symbol' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('et_date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Date {winnersSortField === 'et_date' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('method')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Method {winnersSortField === 'method' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('buy_pct')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Buy% {winnersSortField === 'buy_pct' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('sell_pct')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Sell% {winnersSortField === 'sell_pct' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('day_return_pct')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Return% {winnersSortField === 'day_return_pct' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('n_trades')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Trades {winnersSortField === 'n_trades' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                      <th onClick={() => sortWinners('final_equity')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                        Final Equity {winnersSortField === 'final_equity' && (winnersSortAsc ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSortedWinners().map((winner, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {winner.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {winner.et_date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {winner.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {winner.buy_pct}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {winner.sell_pct}%
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          parseFloat(winner.day_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {winner.day_return_pct}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {winner.n_trades}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${winner.final_equity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Method Consistency Table */}
            {methodConsistency.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Method Consistency
                  </h2>
                  <button
                    onClick={() => exportToCSV(methodConsistency, `baseline-lab-fast-consistency-${startDate}-${endDate}.csv`)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th onClick={() => sortConsistency('symbol')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          Symbol {consistencySortField === 'symbol' && (consistencySortAsc ? '↑' : '↓')}
                        </th>
                        <th onClick={() => sortConsistency('method')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          Method {consistencySortField === 'method' && (consistencySortAsc ? '↑' : '↓')}
                        </th>
                        <th onClick={() => sortConsistency('wins')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          Wins {consistencySortField === 'wins' && (consistencySortAsc ? '↑' : '↓')}
                        </th>
                        <th onClick={() => sortConsistency('total_days')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          Total Days {consistencySortField === 'total_days' && (consistencySortAsc ? '↑' : '↓')}
                        </th>
                        <th onClick={() => sortConsistency('win_rate_pct')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          Win Rate% {consistencySortField === 'win_rate_pct' && (consistencySortAsc ? '↑' : '↓')}
                        </th>
                        <th onClick={() => sortConsistency('avg_return_pct')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                          Avg Return% {consistencySortField === 'avg_return_pct' && (consistencySortAsc ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedConsistency().map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.symbol}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.method}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.wins}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.total_days}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {item.win_rate_pct}%
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            parseFloat(item.avg_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.avg_return_pct}%
                          </td>
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing {symbols.length} symbols across multiple methods and thresholds...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        )}
      </main>
    </div>
  );
}