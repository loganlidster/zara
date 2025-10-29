'use client';

import { useState } from 'react';

interface PatternMatch {
  start_date: string;
  end_date: string;
  start_price: number;
  end_price: number;
  change_pct: number;
  duration_hours: number;
}

interface StrategyResult {
  symbol: string;
  method: string;
  session: string;
  buyPct: number;
  sellPct: number;
  instances: number;
  avgRoi: number;
  consistency: number;
  totalTrades: number;
  avgWinRate: number;
  minRoi: number;
  maxRoi: number;
  category?: string;
}

export default function CustomPatternAnalyzer() {
  // Pattern definition
  const [direction, setDirection] = useState<'surge' | 'drop'>('drop');
  const [magnitude, setMagnitude] = useState('3.5');
  const [timeframe, setTimeframe] = useState('48');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-10-31');

  // Results
  const [matches, setMatches] = useState<PatternMatch[]>([]);
  const [bestWorstResults, setBestWorstResults] = useState<StrategyResult[]>([]);
  const [selectedOffset, setSelectedOffset] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'define' | 'matches' | 'analyze'>('define');

  const handleFindPatterns = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('https://tradiac-api-941257247637.us-central1.run.app/api/patterns/custom-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          magnitude: parseFloat(magnitude),
          timeframe: parseInt(timeframe),
          startDate,
          endDate
        })
      });

      const result = await response.json();

      if (result.success) {
        setMatches(result.matches || result.data || []);
        setStep('matches');
      } else {
        throw new Error(result.error || 'Failed to find patterns');
      }
    } catch (err) {
      console.error('Error finding patterns:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeStrategies = async (offset: number) => {
    try {
      setAnalyzing(true);
      setError(null);
      setSelectedOffset(offset);

      // Call the new best-worst-per-stock endpoint
      const response = await fetch('https://tradiac-api-941257247637.us-central1.run.app/api/patterns/best-worst-per-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches,
          offset,
          minInstances: 3
        })
      });

      const result = await response.json();

      if (result.success) {
        setBestWorstResults(result.data);
        setStep('analyze');
      } else {
        throw new Error(result.error || 'Failed to analyze strategies');
      }
    } catch (err) {
      console.error('Error analyzing strategies:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getConsistencyColor = (consistency: number) => {
    if (consistency >= 80) return 'bg-green-100 text-green-800';
    if (consistency >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getOffsetLabel = (offset: number) => {
    if (offset === 0) return 'During Pattern';
    if (offset === 1) return 'Day After (+1)';
    if (offset === 2) return '2 Days After (+2)';
    if (offset === 3) return '3 Days After (+3)';
    return `${offset} Days After (+${offset})`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Custom Pattern Analyzer</h1>
            <a
              href="/"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Home
            </a>
          </div>
          <p className="text-gray-600">
            Define your own patterns and discover which strategies work best during and after those patterns
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Step 1: Define Pattern */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Define Your Pattern</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'surge' | 'drop')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="surge">Surge (Up)</option>
                <option value="drop">Drop (Down)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Magnitude (%)</label>
              <input
                type="number"
                step="0.1"
                value={magnitude}
                onChange={(e) => setMagnitude(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe (hours)</label>
              <input
                type="number"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-sm text-blue-800">
              Looking for: BTC <strong>{direction === 'surge' ? 'rises' : 'drops'}</strong> <strong>{magnitude}%</strong> or more in <strong>{timeframe}</strong> hours
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Date range: {formatDate(startDate)} to {formatDate(endDate)}
            </p>
          </div>

          <button
            onClick={handleFindPatterns}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Finding Patterns...' : 'Find Patterns'}
          </button>
        </div>

        {/* Step 2: Pattern Matches */}
        {step !== 'define' && matches && matches.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 2: Pattern Matches ({matches.length} found)
            </h2>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-900">{matches.length}</div>
                <div className="text-sm text-blue-700">Total Matches</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-900">
                  {matches && matches.length > 0 ? (matches.reduce((sum, m) => sum + Math.abs(m.change_pct), 0) / matches.length).toFixed(2) : '0.00'}%
                </div>
                <div className="text-sm text-green-700">Avg Change</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-900">
                  {matches && matches.length > 0 ? Math.max(...matches.map(m => Math.abs(m.change_pct))).toFixed(2) : '0.00'}%
                </div>
                <div className="text-sm text-purple-700">Max Change</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-900">
                  {matches && matches.length > 0 ? (matches.reduce((sum, m) => sum + m.duration_hours, 0) / matches.length).toFixed(1) : '0.0'}h
                </div>
                <div className="text-sm text-orange-700">Avg Duration</div>
              </div>
            </div>

            {/* Analyze Buttons */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Analyze strategies for:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAnalyzeStrategies(0)}
                  disabled={analyzing}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {analyzing && selectedOffset === 0 ? 'Analyzing...' : 'During Pattern (0)'}
                </button>
                <button
                  onClick={() => handleAnalyzeStrategies(1)}
                  disabled={analyzing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {analyzing && selectedOffset === 1 ? 'Analyzing...' : '1 Day After (+1)'}
                </button>
                <button
                  onClick={() => handleAnalyzeStrategies(2)}
                  disabled={analyzing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {analyzing && selectedOffset === 2 ? 'Analyzing...' : '2 Days After (+2)'}
                </button>
                <button
                  onClick={() => handleAnalyzeStrategies(3)}
                  disabled={analyzing}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                >
                  {analyzing && selectedOffset === 3 ? 'Analyzing...' : '3 Days After (+3)'}
                </button>
              </div>
            </div>

            {/* Matches Table */}
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matches && matches.slice(0, 50).map((match, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatDate(match.start_date)} to {formatDate(match.end_date)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        ${match.start_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        ${match.end_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          match.change_pct < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {match.change_pct > 0 ? '+' : ''}{match.change_pct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {match.duration_hours}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {matches && matches.length > 50 && (
                <p className="text-center text-sm text-gray-500 mt-2">
                  Showing first 50 of {matches.length} matches
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Strategy Analysis Results */}
        {step === 'analyze' && bestWorstResults && bestWorstResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 3: Best & Worst Strategies Per Stock - {getOffsetLabel(selectedOffset)}
            </h2>

            <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-800">
                Showing the <strong>BEST</strong> and <strong>WORST</strong> performing strategy for each stock during the {matches.length} pattern instances.
                Green rows = Best performers, Red rows = Worst performers.
              </p>
            </div>

            {/* Best/Worst Per Stock Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buy %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sell %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consistency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instances</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bestWorstResults && bestWorstResults.map((result, index) => (
                    <tr key={index} className={`hover:bg-gray-50 ${
                      result.category === 'BEST' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {result.symbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          result.session === 'RTH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {result.session}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          result.category === 'BEST' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'
                        }`}>
                          {result.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {result.method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {result.buyPct}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {result.sellPct}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          result.avgRoi > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {result.avgRoi > 0 ? '+' : ''}{result.avgRoi.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getConsistencyColor(result.consistency)}`}>
                          {result.consistency.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {result.instances}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {result.avgWinRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-900 font-semibold mb-2">💡 How to Use This Tool</h3>
          <ul className="text-blue-800 text-sm space-y-2">
            <li>• <strong>Step 1:</strong> Define your pattern (direction, magnitude, timeframe)</li>
            <li>• <strong>Step 2:</strong> Review all matching historical instances and click an offset button</li>
            <li>• <strong>Step 3:</strong> See the BEST and WORST strategy for each stock+session combination</li>
            <li>• <strong>Offset 0:</strong> Shows what works DURING the pattern</li>
            <li>• <strong>Offset +1:</strong> Shows what works the DAY AFTER the pattern</li>
            <li>• <strong>Offset +2/+3:</strong> Shows what works 2-3 days after</li>
            <li>• <strong>Consistency:</strong> % of times the strategy was profitable (higher = more reliable)</li>
            <li>• <strong>Green rows:</strong> Best performing strategies for that stock+session</li>
            <li>• <strong>Red rows:</strong> Worst performing strategies for that stock+session</li>
          </ul>
        </div>
      </div>
    </div>
  );
}