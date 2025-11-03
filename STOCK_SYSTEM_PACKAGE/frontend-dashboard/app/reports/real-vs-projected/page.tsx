'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';

interface Wallet {
  wallet_id: string;
  name: string;
  env: string;
  enabled: boolean;
  stock_count: number;
  enabled_stock_count: number;
}

interface TradeComparison {
  symbol: string;
  date: string;
  time: string;
  type: string;
  projected_price: number | null;
  actual_price: number | null;
  slippage: number | null;
  slippage_pct: number | null;
  projected_shares: number | null;
  actual_shares: number | null;
  status: string;
}

interface ComparisonData {
  wallet: {
    wallet_id: string;
    name: string;
    env: string;
    stock_count: number;
  };
  projected: {
    totalReturn: number;
    totalReturnPct: number;
    finalEquity: number;
    totalTrades: number;
  };
  actual: {
    totalReturn: number;
    totalReturnPct: number;
    finalEquity: number;
    totalTrades: number;
  };
  comparison: {
    returnDifference: number;
    returnDifferencePct: number;
    tradesDifference: number;
    avgSlippage: number;
    avgSlippagePct: number;
    matchedTrades: number;
    missedTrades: number;
  };
  tradeComparisons: TradeComparison[];
}

export default function RealVsProjected() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-31');
  const [slippagePct, setSlippagePct] = useState(0.1);
  const [conservativeRounding, setConservativeRounding] = useState(true);
  
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load wallets on mount
  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      setLoadingWallets(true);
      const response = await fetch(`${API_URL}/api/wallets`);
      const result = await response.json();
      
      if (result.success) {
        setWallets(result.wallets);
        // Auto-select first enabled wallet
        const firstEnabled = result.wallets.find((w: Wallet) => w.enabled);
        if (firstEnabled) {
          setSelectedWallet(firstEnabled.wallet_id);
        }
      }
    } catch (err: any) {
      console.error('Error loading wallets:', err);
      setError('Failed to load wallets');
    } finally {
      setLoadingWallets(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedWallet) {
      setError('Please select a wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/real-vs-projected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_id: selectedWallet,
          startDate,
          endDate,
          slippagePct,
          conservativeRounding
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

  const exportCSV = () => {
    if (!data) return;

    const headers = ['Date', 'Time', 'Symbol', 'Type', 'Projected Price', 'Actual Price', 'Slippage', 'Slippage %', 'Status'];
    const rows = data.tradeComparisons.map(t => [
      t.date,
      t.time,
      t.symbol,
      t.type,
      t.projected_price?.toFixed(2) || 'N/A',
      t.actual_price?.toFixed(2) || 'N/A',
      t.slippage?.toFixed(4) || 'N/A',
      t.slippage_pct?.toFixed(2) || 'N/A',
      t.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `real-vs-projected-${selectedWallet}-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  // Prepare slippage distribution data
  const slippageDistribution = data ? (() => {
    const matched = data.tradeComparisons.filter(t => t.status === 'matched' && t.slippage_pct !== null);
    const bins = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1, 2];
    const counts = bins.map((bin, i) => {
      if (i === bins.length - 1) return 0;
      const nextBin = bins[i + 1];
      return matched.filter(t => t.slippage_pct! >= bin && t.slippage_pct! < nextBin).length;
    });

    return bins.slice(0, -1).map((bin, i) => ({
      range: `${bin}% to ${bins[i + 1]}%`,
      count: counts[i]
    }));
  })() : [];

  const selectedWalletData = wallets.find(w => w.wallet_id === selectedWallet);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Real vs Projected Trading</h1>
          <p className="mt-2 text-gray-600">
            Compare simulated results against actual Alpaca execution to measure slippage and validate strategy
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Wallet Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Wallet
              </label>
              {loadingWallets ? (
                <div className="text-gray-500">Loading wallets...</div>
              ) : (
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a wallet --</option>
                  {wallets.map(wallet => (
                    <option key={wallet.wallet_id} value={wallet.wallet_id}>
                      {wallet.name} ({wallet.env}) - {wallet.enabled_stock_count} stocks
                    </option>
                  ))}
                </select>
              )}
              {selectedWalletData && (
                <p className="text-sm text-gray-500 mt-2">
                  {selectedWalletData.enabled_stock_count} enabled stocks in this wallet
                </p>
              )}
            </div>

            {/* Date Range & Settings */}
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

            <button
              type="submit"
              disabled={loading || !selectedWallet}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {loading ? 'Analyzing...' : 'Compare Results'}
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
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Projected Return</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {data.projected.totalReturnPct.toFixed(2)}%
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  ${data.projected.totalReturn.toFixed(2)}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  {data.projected.totalTrades} trades
                </p>
              </div>

              <div className="bg-green-50 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Actual Return</h3>
                <p className="text-3xl font-bold text-green-600">
                  {data.actual.totalReturnPct.toFixed(2)}%
                </p>
                <p className="text-sm text-green-700 mt-1">
                  ${data.actual.totalReturn.toFixed(2)}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  {data.actual.totalTrades} trades
                </p>
              </div>

              <div className={`rounded-lg shadow p-6 ${data.comparison.returnDifferencePct >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <h3 className={`text-lg font-semibold mb-2 ${data.comparison.returnDifferencePct >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  Difference
                </h3>
                <p className={`text-3xl font-bold ${data.comparison.returnDifferencePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.comparison.returnDifferencePct >= 0 ? '+' : ''}{data.comparison.returnDifferencePct.toFixed(2)}%
                </p>
                <p className={`text-sm mt-1 ${data.comparison.returnDifferencePct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ${data.comparison.returnDifference >= 0 ? '+' : ''}{data.comparison.returnDifference.toFixed(2)}
                </p>
                <p className={`text-xs mt-2 ${data.comparison.returnDifferencePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.comparison.tradesDifference >= 0 ? '+' : ''}{data.comparison.tradesDifference} trades
                </p>
              </div>
            </div>

            {/* Slippage & Execution Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Average Slippage</h3>
                <p className="text-2xl font-bold text-gray-800">
                  {data.comparison.avgSlippagePct.toFixed(3)}%
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  ${Math.abs(data.comparison.avgSlippage).toFixed(4)}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Matched Trades</h3>
                <p className="text-2xl font-bold text-gray-800">
                  {data.comparison.matchedTrades}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Successfully executed
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Missed Trades</h3>
                <p className="text-2xl font-bold text-gray-800">
                  {data.comparison.missedTrades}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Not executed
                </p>
              </div>
            </div>

            {/* Slippage Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Slippage Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={slippageDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Trade Comparison Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Trade-by-Trade Comparison</h2>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projected $</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual $</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slippage</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.tradeComparisons.map((trade, i) => (
                      <tr key={i} className={trade.status === 'not_executed' ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.time}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{trade.symbol}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded ${trade.type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${trade.projected_price?.toFixed(2) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {trade.actual_price ? `$${trade.actual_price.toFixed(2)}` : 'Not Filled'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {trade.slippage_pct !== null ? (
                            <span className={trade.slippage_pct >= 0 ? 'text-red-600' : 'text-green-600'}>
                              {trade.slippage_pct >= 0 ? '+' : ''}{trade.slippage_pct.toFixed(2)}%
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded ${
                            trade.status === 'matched' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {trade.status === 'matched' ? 'Filled' : 'Not Executed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}