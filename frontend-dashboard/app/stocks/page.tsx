'use client';

import Link from 'next/link';
import Header from '@/components/Header';

const STOCK_REPORTS = [
  {
    title: 'Fast Daily',
    description: 'Single simulation report showing all BUY/SELL events with detailed performance metrics',
    href: '/reports/fast-daily',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'blue'
  },
  {
    title: 'Best Performers',
    description: 'Find the most profitable buy/sell combinations with win rates and average ROI',
    href: '/reports/best-performers',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'green'
  },
  {
    title: 'Daily Curve & ROI',
    description: 'Multi-symbol performance comparison with Bitcoin benchmark overlay',
    href: '/reports/daily-curve',
    icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
    color: 'indigo'
  },
  {
    title: 'Multi-Stock Daily Curve',
    description: 'Run Daily Curve for multiple stocks simultaneously with individual RTH/AH settings',
    href: '/reports/multi-stock-daily-curve',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'blue'
  },
  {
    title: 'Real vs Projected',
    description: 'Compare simulated results against actual Alpaca execution to measure slippage',
    href: '/reports/real-vs-projected',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'emerald'
  },
  {
    title: 'Method Comparison',
    description: 'Compare performance across different baseline calculation methods',
    href: '/reports/method-comparison',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'purple'
  },
  {
    title: 'Session Analysis',
    description: 'Compare RTH vs AH trading performance and patterns',
    href: '/reports/session-analysis',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'pink'
  },
  {
    title: 'Trade Analysis',
    description: 'Detailed trade-by-trade breakdown with entry/exit analysis',
    href: '/reports/trade-analysis',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    color: 'cyan'
  },
  {
    title: 'Extended Range',
    description: 'Test EQUAL_MEAN with extended thresholds including negative sell values',
    href: '/reports/extended-range',
    icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4',
    color: 'red'
  }
];

const colorClasses = {
  blue: 'from-blue-500 to-blue-600 hover:border-blue-500',
  green: 'from-green-500 to-green-600 hover:border-green-500',
  indigo: 'from-indigo-500 to-indigo-600 hover:border-indigo-500',
  emerald: 'from-emerald-500 to-emerald-600 hover:border-emerald-500',
  purple: 'from-purple-500 to-purple-600 hover:border-purple-500',
  pink: 'from-pink-500 to-pink-600 hover:border-pink-500',
  cyan: 'from-cyan-500 to-cyan-600 hover:border-cyan-500',
  red: 'from-red-500 to-red-600 hover:border-red-500',
  orange: 'from-orange-500 to-orange-600 hover:border-orange-500'
};

export default function StocksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📈 Stock Reports
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Bitcoin Mining Stocks Analysis
          </p>
          <p className="text-sm text-gray-500">
            9 Symbols • RTH & AH Sessions • 5 Baseline Methods • 33M+ Events
          </p>
        </div>

        {/* Report Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {STOCK_REPORTS.map((report) => (
            <Link key={report.href} href={report.href}>
              <div className={`bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border-2 border-transparent ${colorClasses[report.color as keyof typeof colorClasses]}`}>
                <div className="flex items-center mb-4">
                  <div className={`bg-gradient-to-br ${colorClasses[report.color as keyof typeof colorClasses].split(' ')[0]} ${colorClasses[report.color as keyof typeof colorClasses].split(' ')[1]} text-white rounded-full p-3 mr-4`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{report.title}</h2>
                </div>
                <p className="text-gray-600 text-sm">
                  {report.description}
                </p>
                <div className="mt-4 text-blue-500 font-semibold text-sm">
                  View Report →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Back Button */}
        <div className="text-center mt-12">
          <Link href="/">
            <button className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
              ← Back to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}