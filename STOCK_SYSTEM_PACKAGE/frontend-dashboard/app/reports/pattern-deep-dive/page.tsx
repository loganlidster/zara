'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface PatternInstance {
  pattern_id: number;
  pattern_type: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  btc_start_price: number;
  btc_end_price: number;
  btc_change_pct: number;
  btc_high_price: number;
  btc_low_price: number;
  pattern_metrics: any;
}

interface ApiResponse {
  success: boolean;
  data: PatternInstance[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const PATTERN_INFO: Record<string, { name: string; icon: string; color: string }> = {
  'CRASH': { name: 'BTC Crashes', icon: '📉', color: 'red' },
  'SURGE': { name: 'BTC Surges', icon: '📈', color: 'green' },
  'MONDAY_GAP': { name: 'Monday Gaps', icon: '📅', color: 'blue' },
  'HIGH_VOL': { name: 'High Volatility', icon: '⚡', color: 'orange' },
  'LOW_VOL': { name: 'Low Volatility', icon: '😴', color: 'gray' },
  'RECORD_HIGH_DROP': { name: 'Record High Drops', icon: '⭐', color: 'purple' }
};

function PatternDeepDiveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patternType = searchParams.get('type') || 'CRASH';

  const [instances, setInstances] = useState<PatternInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });

  useEffect(() => {
    fetchPatternInstances();
  }, [patternType, pagination.offset]);

  const fetchPatternInstances = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `https://tradiac-api-941257247637.us-central1.run.app/api/patterns/instances?type=${patternType}&limit=${pagination.limit}&offset=${pagination.offset}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if (result.success) {
        setInstances(result.data);
        setPagination(result.pagination);
      } else {
        throw new Error('Failed to fetch pattern instances');
      }
    } catch (err) {
      console.error('Error fetching pattern instances:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePatternTypeChange = (newType: string) => {
    router.push(`/reports/pattern-deep-dive?type=${newType}`);
    setPagination({ ...pagination, offset: 0 });
  };

  const handleNextPage = () => {
    setPagination({ ...pagination, offset: pagination.offset + pagination.limit });
  };

  const handlePrevPage = () => {
    setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // HH:MM
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 bg-green-50';
    if (change < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const info = PATTERN_INFO[patternType] || { name: patternType, icon: '📊', color: 'blue' };

  if (loading && instances.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading pattern instances...</p>
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
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Overview
            </button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{info.icon}</span>
            <div>
              <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{info.name}</h1>
              <a
                href="/"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Back to Home
              </a>
            </div>
              <p className="text-gray-600">
                {pagination.total.toLocaleString()} instances detected
              </p>
            </div>
          </div>
        </div>

        {/* Pattern Type Selector */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Pattern Type:
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PATTERN_INFO).map(([type, typeInfo]) => (
              <button
                key={type}
                onClick={() => handlePatternTypeChange(type)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === patternType
                    ? `bg-${typeInfo.color}-500 text-white`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {typeInfo.icon} {typeInfo.name}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchPatternInstances}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Instances Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    High/Low
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metrics
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {instances.map((instance) => (
                  <tr key={instance.pattern_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(instance.start_date)} {formatTime(instance.start_time)}
                      </div>
                      <div className="text-sm text-gray-500">
                        to {formatDate(instance.end_date)} {formatTime(instance.end_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${instance.btc_start_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${instance.btc_end_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getChangeColor(instance.btc_change_pct)}`}>
                        {instance.btc_change_pct > 0 ? '+' : ''}{instance.btc_change_pct}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        H: ${instance.btc_high_price.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        L: ${instance.btc_low_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-600 max-w-xs">
                        {instance.pattern_metrics && (
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(instance.pattern_metrics, null, 2)}
                          </pre>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} instances
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatternDeepDive() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PatternDeepDiveContent />
    </Suspense>
  );
}