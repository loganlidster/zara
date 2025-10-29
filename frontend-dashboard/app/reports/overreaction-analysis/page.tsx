'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Overreaction {
  pattern_id: number;
  record_high_date: string;
  drop_date: string;
  record_high_price: number;
  price_after_drop: number;
  drop_pct: number;
  days_to_drop: string;
  max_drop_pct: number;
  overreaction_score: number;
}

interface ApiResponse {
  success: boolean;
  data: Overreaction[];
  count: number;
}

export default function OverreactionAnalysis() {
  const router = useRouter();
  const [overreactions, setOverreactions] = useState<Overreaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    fetchOverreactions();
  }, [limit]);

  const fetchOverreactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `https://tradiac-api-941257247637.us-central1.run.app/api/patterns/overreactions?limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if (result.success) {
        setOverreactions(result.data);
      } else {
        throw new Error('Failed to fetch overreactions');
      }
    } catch (err) {
      console.error('Error fetching overreactions:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'bg-red-100 text-red-800 border-red-300';
    if (score >= 5) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (score >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 7) return 'Extreme';
    if (score >= 5) return 'High';
    if (score >= 3) return 'Moderate';
    return 'Low';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading overreaction analysis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold mb-2">Error Loading Overreactions</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchOverreactions}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/reports/pattern-overview')}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              ← Back to Overview
            </button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">⭐</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Overreaction Analysis</h1>
              <p className="text-gray-600">
                Record high drops ranked by overreaction magnitude - Your special pattern!
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-purple-900 font-semibold mb-2">⭐ What is an Overreaction?</h3>
          <div className="text-purple-800 text-sm space-y-2">
            <p>
              <strong>The Setup:</strong> BTC hits a record high (all-time high), triggering FOMO buying and excitement.
            </p>
            <p>
              <strong>The Drop:</strong> Within 5 days, BTC drops 2%+ from that record high, causing panic selling.
            </p>
            <p>
              <strong>Your Edge:</strong> Mining stocks often overreact MORE than BTC itself. The overreaction score measures 
              the magnitude of this freakout - higher scores = bigger opportunities.
            </p>
            <p>
              <strong>Strategy:</strong> Buy the overreaction, sell the recovery. Test which stocks and thresholds 
              capture these moves best.
            </p>
          </div>
        </div>

        {/* Limit Selector */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Show Top:
          </label>
          <div className="flex gap-2">
            {[10, 20, 50, 100].map((value) => (
              <button
                key={value}
                onClick={() => setLimit(value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  value === limit
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">{overreactions.length}</div>
            <div className="text-sm text-gray-600 mt-1">Total Overreactions</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">
              {overreactions.length > 0 
                ? overreactions.reduce((sum, o) => sum + o.overreaction_score, 0) / overreactions.length
                : 0
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">Avg Overreaction Score</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">
              {overreactions.length > 0 ? Math.max(...overreactions.map(o => o.overreaction_score)).toFixed(2) : 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Max Overreaction Score</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">
              {overreactions.length > 0 
                ? (overreactions.reduce((sum, o) => sum + parseFloat(o.days_to_drop), 0) / overreactions.length).toFixed(1)
                : 0
              }
            </div>
            <div className="text-sm text-gray-600 mt-1">Avg Days to Drop</div>
          </div>
        </div>

        {/* Overreactions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Record High Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Record High Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Drop Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price After Drop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Drop %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Drop %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overreaction Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {overreactions.map((overreaction, index) => (
                  <tr key={overreaction.pattern_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {index === 0 && <span className="text-2xl mr-2">🥇</span>}
                        {index === 1 && <span className="text-2xl mr-2">🥈</span>}
                        {index === 2 && <span className="text-2xl mr-2">🥉</span>}
                        <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(overreaction.record_high_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${overreaction.record_high_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(overreaction.drop_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${overreaction.price_after_drop.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        {overreaction.drop_pct}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        {overreaction.max_drop_pct}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{overreaction.days_to_drop}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 inline-flex text-sm font-bold rounded-lg border-2 ${getScoreColor(overreaction.overreaction_score)}`}>
                          {overreaction.overreaction_score}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getScoreLabel(overreaction.overreaction_score)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-900 font-semibold mb-2">📊 Next Steps</h3>
          <ul className="text-blue-800 text-sm space-y-2">
            <li>• Click any overreaction to analyze which strategies performed best during that period</li>
            <li>• Test different buy/sell thresholds to capture the overreaction and recovery</li>
            <li>• Compare which stocks (HIVE, MARA, RIOT, etc.) overreact the most</li>
            <li>• Look for patterns in timing - do overreactions happen faster in certain conditions?</li>
          </ul>
        </div>
      </div>
    </div>
  );
}