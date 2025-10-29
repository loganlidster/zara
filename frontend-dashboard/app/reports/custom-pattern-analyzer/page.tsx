'use client';

import { useState } from 'react';

interface PatternMatch {
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  start_price: number;
  end_price: number;
  change_pct: number;
  high_price: number;
  low_price: number;
  max_gain_pct: number;
  max_drawdown_pct: number;
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
  const [strategies, setStrategies] = useState<StrategyResult[]>([]);
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
        setMatches(result.matches);
        setStep('matches');
      } else {
        throw new Error(result.error || 'Failed to detect patterns');
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

      const response = await fetch('https://tradiac-api-941257247637.us-central1.run.app/api/patterns/analyze-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches,
          offset,
          limit: 100
        })
      });

      const result = await response.json();

      if (result.success) {
        setStrategies(result.data);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Pattern Analyzer</h1>
          <p className="text-gray-600">
            Define your own patterns and discover which strategies work best during and after those patterns
          </p>
        </div>

        {/* Step 1: Define Pattern */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Define Your Pattern</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Direction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Direction
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'surge' | 'drop')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="drop">Drop (Down)</option>
                <option value="surge">Surge (Up)</option>
              </select>
            </div>

            {/* Magnitude */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Magnitude (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={magnitude}
                onChange={(e) => setMagnitude(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3.5"
              />
            </div>

            {/* Timeframe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeframe (hours)
              </label>
              <input
                type="number"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="48"
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Pattern Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-900 font-medium">
              Looking for: BTC {direction === 'surge' ? 'rises' : 'drops'} {magnitude}% or more in {timeframe} hours
            </p>
            <p className="text-blue-700 text-sm mt-1">
              Date range: {formatDate(startDate)} to {formatDate(endDate)}
            </p>
          </div>

          {/* Find Patterns Button */}
          <button
            onClick={handleFindPatterns}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Finding Patterns...' : 'Find Patterns'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Step 2: View Matches */}
        {matches.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 2: Pattern Matches ({matches.length} found)
            </h2>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{matches.length}</div>
                <div className="text-sm text-blue-800">Total Matches</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {(matches.reduce((sum, m) => sum + Math.abs(m.change_pct), 0) / matches.length).toFixed(2)}%
                </div>
                <div className="text-sm text-green-800">Avg Change</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.max(...matches.map(m => Math.abs(m.change_pct))).toFixed(2)}%
                </div>
                <div className="text-sm text-purple-800">Max Change</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.min(...matches.map(m => Math.abs(m.change_pct))).toFixed(2)}%
                </div>
                <div className="text-sm text-orange-800">Min Change</div>
              </div>
            </div>

            {/* Analyze Buttons */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Analyze strategies for:
              </p>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((offset) => (
                  <button
                    key={offset}
                    onClick={() => handleAnalyzeStrategies(offset)}
                    disabled={analyzing}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedOffset === offset && step === 'analyze'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    {getOffsetLabel(offset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Matches Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">High/Low</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matches.slice(0, 20).map((match, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(match.start_date)} to {formatDate(match.end_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${match.start_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${match.end_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          match.change_pct > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {match.change_pct > 0 ? '+' : ''}{match.change_pct}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>H: ${match.high_price.toLocaleString()}</div>
                        <div className="text-gray-500">L: ${match.low_price.toLocaleString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {matches.length > 20 && (
                <div className="text-center py-4 text-sm text-gray-500">
                  Showing first 20 of {matches.length} matches
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Strategy Analysis */}
        {step === 'analyze' && strategies.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 3: Best Strategies - {getOffsetLabel(selectedOffset)}
            </h2>

            {analyzing && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Analyzing strategies across {matches.length} pattern instances...</p>
              </div>
            )}

            {!analyzing && (
              <>
                {/* Top Recommendation */}
                {strategies.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-bold text-purple-900 mb-2">🏆 Top Recommendation</h3>
                    <p className="text-purple-800 text-lg">
                      <strong>{strategies[0].symbol}</strong> with <strong>{strategies[0].method}</strong> ({strategies[0].session})
                    </p>
                    <p className="text-purple-700 mt-2">
                      Buy: {strategies[0].buyPct}% | Sell: {strategies[0].sellPct}%
                    </p>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{strategies[0].avgRoi.toFixed(2)}%</div>
                        <div className="text-sm text-purple-700">Avg ROI</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{strategies[0].consistency.toFixed(1)}%</div>
                        <div className="text-sm text-purple-700">Consistency</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{strategies[0].instances}</div>
                        <div className="text-sm text-purple-700">Tested Instances</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strategies Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buy %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sell %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg ROI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consistency</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instances</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {strategies.map((strategy, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {index === 0 && <span className="text-2xl mr-2">🥇</span>}
                              {index === 1 && <span className="text-2xl mr-2">🥈</span>}
                              {index === 2 && <span className="text-2xl mr-2">🥉</span>}
                              <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                            {strategy.symbol}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {strategy.method}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {strategy.session}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {strategy.buyPct}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {strategy.sellPct}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              strategy.avgRoi > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {strategy.avgRoi > 0 ? '+' : ''}{strategy.avgRoi.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getConsistencyColor(strategy.consistency)}`}>
                              {strategy.consistency.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {strategy.instances}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {strategy.avgWinRate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-900 font-semibold mb-2">💡 How to Use This Tool</h3>
          <ul className="text-blue-800 text-sm space-y-2">
            <li>• <strong>Step 1:</strong> Define your pattern (direction, magnitude, timeframe)</li>
            <li>• <strong>Step 2:</strong> Review all matching historical instances</li>
            <li>• <strong>Step 3:</strong> Analyze which strategies work best during or after the pattern</li>
            <li>• <strong>Offset 0:</strong> Shows what works DURING the pattern</li>
            <li>• <strong>Offset +1:</strong> Shows what works the DAY AFTER the pattern</li>
            <li>• <strong>Offset +2/+3:</strong> Shows what works 2-3 days after</li>
            <li>• <strong>Consistency:</strong> % of times the strategy was profitable (higher = more reliable)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}