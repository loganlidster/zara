'use client';

import { useState } from 'react';
import { getTopPerformers, getTopPerformersRange, TopPerformer, TopPerformersResponse } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

const SYMBOLS = ['HIVE', 'RIOT', 'MARA', 'CLSK', 'BTDR', 'CORZ', 'HUT', 'CAN', 'CIFR', 'APLD', 'WULF'];
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
  
  // Version indicator for cache busting
  console.log('Best Performers Report v3.0 - Multi-select + Per-stock view');
  
  // Set default dates to yesterday and today
  const getYesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };
  
  const getToday = () => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  };
  
  const [startDate, setStartDate] = useState(getYesterday());
  const [endDate, setEndDate] = useState(getToday());
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['HIVE', 'RIOT', 'MARA']); // Multi-select
  const [methodFilter, setMethodFilter] = useState('All');
  const [sessionFilter, setSessionFilter] = useState('All');
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState<'overall' | 'per-stock'>('overall'); // New: view mode
  const [loading, setLoading] = useState(false);
  const [performers, setPerformers] = useState<TopPerformer[]>([]);
  const [sortColumn, setSortColumn] = useState<keyof TopPerformer>('roiPct');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<{ step1: number; step2: number; total: number; candidatesEvaluated: number } | null>(null);
  
  // Range testing mode
  const [mode, setMode] = useState<'all' | 'range'>('all');
  const [buyMin, setBuyMin] = useState(0.4);
  const [buyMax, setBuyMax] = useState(0.6);
  const [sellMin, setSellMin] = useState(0.1);
  const [sellMax, setSellMax] = useState(0.3);

  // Symbol selection handlers
  const handleSymbolToggle = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const handleSelectAllSymbols = () => {
    setSelectedSymbols([...SYMBOLS]);
  };

  const handleClearAllSymbols = () => {
    setSelectedSymbols([]);
  };

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
      // Validate symbol selection
      if (selectedSymbols.length === 0) {
        setError('Please select at least one symbol');
        setLoading(false);
        return;
      }

      let response: TopPerformersResponse;
      
      if (mode === 'range') {
        // Range testing mode - only works with single symbol
        if (selectedSymbols.length > 1) {
          setError('Range testing requires a single symbol. Please select only one symbol.');
          setLoading(false);
          return;
        }
        
        response = await getTopPerformersRange({
          symbol: selectedSymbols[0],
          method: methodFilter === 'All' ? undefined : methodFilter,
          session: sessionFilter === 'All' ? undefined : sessionFilter,
          buyMin,
          buyMax,
          sellMin,
          sellMax,
          startDate,
          endDate,
          limit
        });
      } else {
        // All mode - supports multiple symbols
        const params: any = {
          startDate,
          endDate,
          limit: viewMode === 'per-stock' ? limit * selectedSymbols.length : limit, // Increase limit for per-stock view
          viewMode // Pass view mode to backend
        };
  
        // Pass selected symbols (not 'All')
        params.symbols = selectedSymbols;
        if (methodFilter !== 'All') params.method = methodFilter;
        if (sessionFilter !== 'All') params.session = sessionFilter;

        response = await getTopPerformers(params);
      }
        
      console.log('Raw API response:', response);
      
      // Extract timing info if available
      if (response.timing) {
        setTiming(response.timing);
        console.log('Timing:', response.timing);
      }
      
      // Get the actual performers array
      const performersData = response.topPerformers || [];
      
      if (performersData && performersData.length > 0) {
        console.log('First item:', performersData[0]);
        console.log('First item keys:', Object.keys(performersData[0]));
        console.log('roiPct value:', performersData[0].roiPct);
        console.log('roiPct type:', typeof performersData[0].roiPct);
      }
      
      // Filter out any invalid data
      const validData = performersData.filter(p => {
        if (!p) {
          console.log('Null/undefined item');
          return false;
        }
        
        const hasRoiPct = p.roiPct !== undefined && p.roiPct !== null;
        const isNumber = typeof p.roiPct === 'number';
        const notNaN = !isNaN(p.roiPct);
        const hasSymbol = !!p.symbol;
        const hasMethod = !!p.method;
        const hasSession = !!p.session;
        
        const isValid = hasRoiPct && isNumber && notNaN && hasSymbol && hasMethod && hasSession;
        
        if (!isValid) {
          console.log('Invalid performer data:', {
            item: p,
            hasRoiPct,
            isNumber,
            notNaN,
            hasSymbol,
            hasMethod,
            hasSession
          });
        }
        
        return isValid;
      });
      
      console.log('Valid data count:', validData.length, 'out of', performersData.length);
      
      setPerformers(validData);
      
      if (validData.length === 0 && performersData.length > 0) {
        setError('No valid data returned. The query may have timed out or returned incomplete results.');
      }
    } catch (err: any) {
      console.error('Error fetching performers:', err);
      setError(err.message || 'Failed to fetch data');
      setPerformers([]);
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
      buyPct: performer.buyPct.toString(),
      sellPct: performer.sellPct.toString(),
      startDate,
      endDate
    });
    
    router.push(`/reports/fast-daily?${params.toString()}`);
  };

  // Group performers by symbol for per-stock view
  const groupedPerformers = viewMode === 'per-stock' 
    ? SYMBOLS.reduce((acc, symbol) => {
        acc[symbol] = sortedPerformers.filter(p => p.symbol === symbol).slice(0, limit);
        return acc;
      }, {} as Record<string, TopPerformer[]>)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Best Performers</h1>
          <a
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </a>
        </div>
        <p className="text-gray-600 mb-8">Find the best performing trading strategies</p>

        {/* Filters */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mode
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="all"
                  checked={mode === 'all'}
                  onChange={(e) => setMode(e.target.value as 'all' | 'range')}
                  className="mr-2"
                />
                All Combinations
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="range"
                  checked={mode === 'range'}
                  onChange={(e) => setMode(e.target.value as 'all' | 'range')}
                  className="mr-2"
                />
                Range Testing
              </label>
            </div>
          </div>

          {/* Symbol Multi-Select */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Symbols {mode === 'range' && '(select one for range testing)'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSymbols}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllSymbols}
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

          {/* View Mode (only for 'all' mode) */}
          {mode === 'all' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Mode
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="overall"
                    checked={viewMode === 'overall'}
                    onChange={(e) => setViewMode(e.target.value as 'overall' | 'per-stock')}
                    className="mr-2"
                  />
                  Overall Top Performers
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="per-stock"
                    checked={viewMode === 'per-stock'}
                    onChange={(e) => setViewMode(e.target.value as 'overall' | 'per-stock')}
                    className="mr-2"
                  />
                  Top Performers Per Stock
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {viewMode === 'overall' 
                  ? 'Shows the best performers across all selected symbols'
                  : 'Shows the top performers for each symbol separately'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Method Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {METHODS.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            {/* Session Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session
              </label>
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SESSIONS.map(session => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
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

            {/* End Date */}
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

          {/* Range Testing Parameters */}
          {mode === 'range' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Range Testing Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buy % Range
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={buyMin}
                      onChange={(e) => setBuyMin(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Min"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      step="0.1"
                      value={buyMax}
                      onChange={(e) => setBuyMax(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Max"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sell % Range
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.1"
                      value={sellMin}
                      onChange={(e) => setSellMin(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Min"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      step="0.1"
                      value={sellMax}
                      onChange={(e) => setSellMax(parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Limit */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Results Limit {viewMode === 'per-stock' && '(per stock)'}
            </label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || selectedSymbols.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Loading...' : 'Find Best Performers'}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Timing Info */}
        {timing && (
          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm text-blue-800">
              <strong>Performance:</strong> Step 1: {timing.step1}ms | Step 2: {timing.step2}ms | Total: {timing.total}ms | Candidates Evaluated: {timing.candidatesEvaluated}
            </p>
          </div>
        )}

        {/* Results */}
        {performers.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {viewMode === 'overall' ? 'Top Performers' : 'Top Performers by Stock'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {performers.length} result{performers.length !== 1 ? 's' : ''} found
                {viewMode === 'per-stock' && ` across ${selectedSymbols.length} symbol${selectedSymbols.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {viewMode === 'overall' ? (
              // Overall view - single table
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        onClick={() => handleSort('symbol')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Symbol {sortColumn === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('method')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Method {sortColumn === 'method' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('session')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Session {sortColumn === 'session' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('buyPct')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Buy % {sortColumn === 'buyPct' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('sellPct')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Sell % {sortColumn === 'sellPct' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('roiPct')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        ROI % {sortColumn === 'roiPct' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('totalTrades')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        Trades {sortColumn === 'totalTrades' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedPerformers.map((performer, idx) => (
                      <tr 
                        key={idx}
                        onClick={() => handleRowClick(performer)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {performer.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {performer.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {performer.session}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {performer.buyPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {performer.sellPct.toFixed(1)}%
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                          performer.roiPct >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {performer.roiPct.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {performer.totalTrades}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Per-stock view - grouped tables
              <div className="p-6 space-y-8">
                {selectedSymbols.map(symbol => {
                  const symbolPerformers = groupedPerformers?.[symbol] || [];
                  if (symbolPerformers.length === 0) return null;
                  
                  return (
                    <div key={symbol} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">{symbol}</h3>
                        <p className="text-sm text-gray-600">{symbolPerformers.length} top performer{symbolPerformers.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Method
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Session
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Buy %
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Sell %
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                ROI %
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Trades
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {symbolPerformers.map((performer, idx) => (
                              <tr 
                                key={idx}
                                onClick={() => handleRowClick(performer)}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {performer.method}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {performer.session}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {performer.buyPct.toFixed(1)}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {performer.sellPct.toFixed(1)}%
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                                  performer.roiPct >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {performer.roiPct.toFixed(2)}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {performer.totalTrades}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}