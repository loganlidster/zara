'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const SESSIONS = ['RTH', 'AH', 'ALL'];

interface BaselineCheckResponse {
  success: boolean;
  symbol: string;
  date: string;
  session: string;
  nDays: number;
  baselines: Record<string, number>;
  sampleCounts: Record<string, number>;
  stats: Record<string, {
    minRatio: number;
    maxRatio: number;
    avgStdDev: number;
  }>;
  previousDates: string[];
}

export default function BaselineCheckReport() {
  const [symbol, setSymbol] = useState('HIVE');
  const [date, setDate] = useState('2024-10-29');
  const [session, setSession] = useState('RTH');
  const [nDays, setNDays] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BaselineCheckResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradiac-api-941257247637.us-central1.run.app';
      const response = await fetch(`${API_URL}/api/baseline/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          date,
          session,
          nDays
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error checking baseline:', err);
      setError(err.message || 'Failed to check baseline');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Baseline Check</h1>
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </a>
        </div>
        <p className="text-gray-600 mb-8">Quick baseline calculation verification for a specific date</p>

        {/* Filters */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SYMBOLS.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Session */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SESSIONS.map(sess => (
                  <option key={sess} value={sess}>{sess}</option>
                ))}
              </select>
            </div>

            {/* N Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Previous Trading Days (N)
              </label>
              <input
                type="number"
                value={nDays}
                onChange={(e) => setNDays(parseInt(e.target.value))}
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Checking...' : 'Check Baseline'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Baseline for {data.symbol}</strong> on {data.date} ({data.session} session)
                {data.nDays > 1 && ` - averaged over ${data.nDays} previous trading days`}
              </p>
              {data.previousDates.length > 0 && (
                <p className="text-sm text-blue-700 mt-1">
                  Previous dates used: {data.previousDates.join(', ')}
                </p>
              )}
            </div>

            {/* Baselines Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Baseline Values by Method</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Baseline
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sample Count
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Min Ratio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Ratio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Std Dev
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(data.baselines).map(([method, baseline]) => (
                      <tr key={method}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {baseline.toFixed(6)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {data.sampleCounts[method]}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {data.stats[method]?.minRatio.toFixed(6)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {data.stats[method]?.maxRatio.toFixed(6)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {data.stats[method]?.avgStdDev.toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Method Comparison</h2>
              <div className="space-y-3">
                {Object.entries(data.baselines).map(([method, baseline]) => {
                  const maxBaseline = Math.max(...Object.values(data.baselines));
                  const widthPercent = (baseline / maxBaseline) * 100;
                  
                  return (
                    <div key={method}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{method}</span>
                        <span className="text-sm text-gray-600 font-mono">{baseline.toFixed(6)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${widthPercent}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            {data.sampleCounts[method]} samples
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}