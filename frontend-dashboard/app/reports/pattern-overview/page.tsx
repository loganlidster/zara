'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PatternSummary {
  pattern_type: string;
  instance_count: number;
  avg_change_pct: number;
  min_change_pct: number;
  max_change_pct: number;
  first_occurrence: string;
  last_occurrence: string;
  avg_price_change: number;
}

interface ApiResponse {
  success: boolean;
  data: PatternSummary[];
  total_patterns: number;
}

const PATTERN_DESCRIPTIONS: Record<string, { name: string; description: string; icon: string }> = {
  'CRASH': {
    name: 'BTC Crashes',
    description: 'BTC drops 3%+ in 72 hours - market panic periods',
    icon: '📉'
  },
  'SURGE': {
    name: 'BTC Surges',
    description: 'BTC rises 5%+ in 24 hours - FOMO rally periods',
    icon: '📈'
  },
  'MONDAY_GAP': {
    name: 'Monday Gaps',
    description: 'Weekend moves create 1%+ Monday opening gaps',
    icon: '📅'
  },
  'HIGH_VOL': {
    name: 'High Volatility',
    description: '30-day volatility above 4% - uncertain markets',
    icon: '⚡'
  },
  'LOW_VOL': {
    name: 'Low Volatility',
    description: '30-day volatility below 2% - calm markets',
    icon: '😴'
  },
  'RECORD_HIGH_DROP': {
    name: 'Record High Drops',
    description: 'BTC hits record high, then drops 2%+ within 5 days - overreaction pattern',
    icon: '⭐'
  }
};

export default function PatternOverview() {
  const router = useRouter();
  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPatterns, setTotalPatterns] = useState(0);

  useEffect(() => {
    fetchPatternSummary();
  }, []);

  const fetchPatternSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('https://tradiac-api-941257247637.us-central1.run.app/api/patterns/summary');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if (result.success) {
        setPatterns(result.data);
        setTotalPatterns(result.total_patterns);
      } else {
        throw new Error('Failed to fetch pattern summary');
      }
    } catch (err) {
      console.error('Error fetching pattern summary:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePatternClick = (patternType: string) => {
    router.push(`/reports/pattern-deep-dive?type=${patternType}`);
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading pattern analysis...</p>
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
            <h3 className="text-red-800 font-semibold mb-2">Error Loading Patterns</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchPatternSummary}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pattern Analysis Overview</h1>
          <p className="text-gray-600">
            Detected {totalPatterns.toLocaleString()} pattern instances across 6 pattern types from Jan 2024 - Oct 2025
          </p>
        </div>

        {/* Pattern Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patterns.map((pattern) => {
            const info = PATTERN_DESCRIPTIONS[pattern.pattern_type] || {
              name: pattern.pattern_type,
              description: 'Pattern description',
              icon: '📊'
            };

            return (
              <div
                key={pattern.pattern_type}
                onClick={() => handlePatternClick(pattern.pattern_type)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{info.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
                      <p className="text-sm text-gray-500">{pattern.pattern_type}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">{info.description}</p>

                {/* Stats */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Instances:</span>
                    <span className="text-lg font-bold text-blue-600">
                      {pattern.instance_count.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg Change:</span>
                    <span className={`text-sm font-semibold ${getChangeColor(pattern.avg_change_pct)}`}>
                      {pattern.avg_change_pct > 0 ? '+' : ''}{pattern.avg_change_pct}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Range:</span>
                    <span className="text-sm font-medium text-gray-700">
                      {pattern.min_change_pct}% to {pattern.max_change_pct}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Period:</span>
                    <span className="text-xs text-gray-500">
                      {formatDate(pattern.first_occurrence)} - {formatDate(pattern.last_occurrence)}
                    </span>
                  </div>
                </div>

                {/* Click to explore */}
                <div className="mt-4 pt-4 border-t">
                  <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Explore Pattern →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{patterns.length}</div>
              <div className="text-sm text-gray-600 mt-1">Pattern Types</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{totalPatterns.toLocaleString()}</div>
              <div className="text-sm text-gray-600 mt-1">Total Instances</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {patterns.find(p => p.pattern_type === 'RECORD_HIGH_DROP')?.instance_count || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Overreactions ⭐</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">650+</div>
              <div className="text-sm text-gray-600 mt-1">Days Analyzed</div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-900 font-semibold mb-2">💡 How to Use Pattern Analysis</h3>
          <ul className="text-blue-800 text-sm space-y-2">
            <li>• Click any pattern card to see all instances of that pattern</li>
            <li>• Each pattern represents specific market conditions (crashes, surges, volatility, etc.)</li>
            <li>• Use patterns to test which strategies work best during specific market conditions</li>
            <li>• The ⭐ Record High Drop pattern is your special overreaction detector</li>
          </ul>
        </div>
      </div>
    </div>
  );
}