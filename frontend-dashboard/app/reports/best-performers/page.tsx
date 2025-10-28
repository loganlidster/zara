'use client';

import { useState } from 'react';
import { getTopPerformers, TopPerformer } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

const SYMBOLS = ['All', 'HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
const METHODS = ['All', 'EQUAL_MEAN', 'VWAP_RATIO', 'VOL_WEIGHTED', 'WINSORIZED', 'WEIGHTED_MEDIAN'];
const SESSIONS = ['All', 'RTH', 'AH'];

// Helper function to format date as MM/DD/YYYY
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export default function BestPerformersReport() {
  const router = useRouter();
  const [startDate, setStartDate] = useState('2024-09-01');
  const [endDate, setEndDate] = useState('2025-10-22');
  const [symbolFilter, setSymbolFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [sessionFilter, setSessionFilter] = useState('All');
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [performers, setPerformers] = useState<TopPerformer[]>([]);
  const [sortColumn, setSortColumn] = useState<keyof TopPerformer>('roi_pct');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  const handleSort = (column: keyof TopPerformer) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedPerformers = [...performers].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        startDate,
        endDate,
        limit
      };

      if (symbolFilter !== 'All') params.symbol = symbolFilter;
      if (methodFilter !== 'All') params.method = methodFilter;
      if (sessionFilter !== 'All') params.session = sessionFilter;

      const data = await getTopPerformers(params);
      
      // Filter out any invalid data
      const validData = data.filter(p => 
        p && 
        typeof p.roi_pct === 'number' && 
        !isNaN(p.roi_pct) &&
        p.symbol && 
        p.method && 
        p.session
      );
      
      setPerformers(validData);
      
      if (validData.length === 0 && data.length > 0) {
        setError('No valid data returned. The query may have timed out or returned incomplete results.');
      }
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        setError('Query timed out. Try using more specific filters (symbol, method, or session) or a smaller date range.');
      } else {
        setError(err.message || 'Failed to fetch data');
      }
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (performer: TopPerformer) => {
    // Navigate to Fast Daily with these parameters
    const params = new URLSearchParams({
      symbol: performer.symbol,
      method: performer.method,
      session: performer.session,
      buyPct: performer.buy_pct.toString(),
      sellPct: performer.sell_pct.toString(),
      startDate,
      endDate
    });
    router.push(`/reports/fast-daily?${params.toString()}`);
  };

  const exportToCSV = () => {
    if (sortedPerformers.length === 0) return;
    
    const headers = [
      'Rank', 'Symbol', 'Method', 'Session', 'Buy %', 'Sell %', 'ROI %', 'Total Events', 'Sell Events'
    ];
    
    const rows = sortedPerformers.map((p, idx) => [
      idx + 1,
      p.symbol,
      p.method,
      p.session,
      p.buy_pct,
      p.sell_pct,
      p.roi_pct.toFixed(2),
      p.total_events,
      p.sell_events
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `best-performers-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="min-h-screen relative bg-white">
      {/* Logo Watermark Background */}
      <div 
        className="fixed inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'url(/RAAS_primary_transparent_512.png)',
          backgroundSize: '700px 700px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <Header />
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Best Performers</h1>
          <p className="text-gray-600">Top performing trading combinations ranked by ROI</p>
        </div>

        {/* Filter Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          {/* Warning for large queries */}
          {symbolFilter === 'All' && methodFilter === 'All' && sessionFilter === 'All' && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
              <p className="text-sm">
                <strong>Tip:</strong> Querying all symbols, methods, and sessions may take longer. 
                For faster results, try filtering by a specific symbol, method, or session.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Symbol Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
              <select
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Method Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Session Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Show Top</label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex items-end md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Run Report'}
              </button>
            </div>
          </form>

          {/* Export Button */}
          {sortedPerformers.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={exportToCSV}
                className="w-full bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 transition-colors"
              >
                Export to CSV
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results Table */}
        {sortedPerformers.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                Top {sortedPerformers.length} Performers
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(startDate)} - {formatDate(endDate)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('symbol')}
                    >
                      Symbol {sortColumn === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('method')}
                    >
                      Method {sortColumn === 'method' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('session')}
                    >
                      Session {sortColumn === 'session' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('buy_pct')}
                    >
                      Buy % {sortColumn === 'buy_pct' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('sell_pct')}
                    >
                      Sell % {sortColumn === 'sell_pct' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('roi_pct')}
                    >
                      ROI % {sortColumn === 'roi_pct' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_events')}
                    >
                      Events {sortColumn === 'total_events' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('sell_events')}
                    >
                      Trades {sortColumn === 'sell_events' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedPerformers.map((performer, idx) => {
                    const rank = idx + 1;
                    const medal = getMedalIcon(rank);
                    return (
                      <tr 
                        key={`${performer.symbol}-${performer.method}-${performer.session}-${performer.buy_pct}-${performer.sell_pct}`}
                        onClick={() => handleRowClick(performer)}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {medal ? <span className="text-2xl">{medal}</span> : rank}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {performer.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {performer.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            performer.session === 'RTH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {performer.session}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {performer.buy_pct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {performer.sell_pct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                            performer.roi_pct >= 10 ? 'bg-green-100 text-green-800' :
                            performer.roi_pct >= 5 ? 'bg-green-50 text-green-700' :
                            performer.roi_pct >= 0 ? 'bg-gray-100 text-gray-700' :
                            performer.roi_pct >= -5 ? 'bg-red-50 text-red-700' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {performer.roi_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {performer.total_events}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {performer.sell_events}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Data */}
        {!loading && sortedPerformers.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">Run a report to see top performers</p>
          </div>
        )}
      </div>
    </div>
  );
}