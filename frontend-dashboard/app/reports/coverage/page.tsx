'use client';

import { useState } from 'react';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];

interface CoverageData {
  symbol: string;
  totalDays: number;
  daysWithData: number;
  stockMinutes: number;
  coveragePct: number;
  missingDates: string[];
  error?: string;
}

interface CoverageResponse {
  success: boolean;
  totalTradingDays: number;
  coverage: CoverageData[];
  btcMinutes: number;
  summary: {
    totalSymbols: number;
    avgCoverage: number;
    symbolsWithIssues: number;
    symbolsComplete: number;
  };
}

export default function CoverageReport() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['HIVE', 'RIOT', 'MARA']);
  const [startDate, setStartDate] = useState('2024-10-01');
  const [endDate, setEndDate] = useState('2024-10-29');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CoverageResponse | null>(null);

  const handleSymbolToggle = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/data/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: selectedSymbols,
          startDate,
          endDate
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error fetching coverage:', err);
      setError(err.message || 'Failed to fetch coverage data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const headers = ['Symbol', 'Total Days', 'Days with Data', 'Stock Minutes', 'Coverage %', 'Missing Dates'];
    const rows = data.coverage.map(c => [
      c.symbol,
      c.totalDays,
      c.daysWithData,
      c.stockMinutes,
      c.coveragePct.toFixed(2),
      c.missingDates.join('; ')
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coverage-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Coverage Report</h1>
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </a>
        </div>
        <p className="text-gray-600 mb-8">Data quality and coverage analysis</p>

        {/* Filters */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Symbol Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Symbols
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => handleSymbolToggle(symbol)}
                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                    selectedSymbols.includes(symbol)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Selected: {selectedSymbols.length} symbol{selectedSymbols.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || selectedSymbols.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Analyzing Coverage...' : 'Analyze Coverage'}
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
            {/* Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Symbols</p>
                  <p className="text-2xl font-bold text-gray-900">{data.summary.totalSymbols}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Coverage</p>
                  <p className="text-2xl font-bold text-green-600">{data.summary.avgCoverage.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Complete</p>
                  <p className="text-2xl font-bold text-green-600">{data.summary.symbolsComplete}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">With Issues</p>
                  <p className="text-2xl font-bold text-red-600">{data.summary.symbolsWithIssues}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">BTC Minutes</p>
                  <p className="text-2xl font-bold text-gray-900">{data.btcMinutes.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Coverage Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Coverage by Symbol</h2>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Symbol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days with Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Minutes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coverage %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Missing Dates
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.coverage.map((item) => (
                      <tr key={item.symbol}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.daysWithData} / {item.totalDays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.stockMinutes.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`text-sm font-semibold ${
                              item.coveragePct === 100 ? 'text-green-600' :
                              item.coveragePct >= 90 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {item.coveragePct.toFixed(1)}%
                            </span>
                            <div className="ml-2 w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  item.coveragePct === 100 ? 'bg-green-600' :
                                  item.coveragePct >= 90 ? 'bg-yellow-600' :
                                  'bg-red-600'
                                }`}
                                style={{ width: `${item.coveragePct}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.missingDates.length === 0 ? (
                            <span className="text-green-600">None</span>
                          ) : (
                            <details className="cursor-pointer">
                              <summary className="text-red-600 hover:text-red-800">
                                {item.missingDates.length} date{item.missingDates.length !== 1 ? 's' : ''}
                              </summary>
                              <div className="mt-2 text-xs">
                                {item.missingDates.join(', ')}
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Coverage Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Coverage Visualization</h2>
              <div className="space-y-3">
                {data.coverage.map((item) => (
                  <div key={item.symbol}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.symbol}</span>
                      <span className="text-sm text-gray-600">{item.coveragePct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className={`h-6 rounded-full flex items-center justify-end pr-2 ${
                          item.coveragePct === 100 ? 'bg-green-600' :
                          item.coveragePct >= 90 ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${item.coveragePct}%` }}
                      >
                        <span className="text-xs text-white font-medium">
                          {item.daysWithData}/{item.totalDays} days
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}