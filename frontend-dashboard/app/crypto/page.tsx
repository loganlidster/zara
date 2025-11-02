'use client';

import Link from 'next/link';
import Header from '@/components/Header';

const CRYPTO_REPORTS = [
  {
    title: 'Daily Curve',
    description: 'View crypto price movements with BUY/SELL signals based on baseline deviations (24/7 trading)',
    href: '/reports/crypto-daily-curve',
    icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
    color: 'orange',
    status: 'live'
  },
  {
    title: 'Best Performers',
    description: 'Find the most profitable buy/sell combinations across 27 cryptocurrencies',
    href: '/reports/crypto-best-performers',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'green',
    status: 'coming-soon'
  },
  {
    title: 'Fast Daily',
    description: 'Quick performance summary showing total events, returns, and win rates',
    href: '/reports/crypto-fast-daily',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'blue',
    status: 'coming-soon'
  },
  {
    title: 'Multi-Crypto Comparison',
    description: 'Compare multiple cryptocurrencies on the same chart with synchronized signals',
    href: '/reports/crypto-multi-curve',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'purple',
    status: 'coming-soon'
  },
  {
    title: 'Method Comparison',
    description: 'Compare EQUAL_MEAN vs WINSORIZED performance across all cryptos',
    href: '/reports/crypto-method-comparison',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'indigo',
    status: 'coming-soon'
  },
  {
    title: 'Stablecoin Analysis',
    description: 'Analyze fee reduction strategies using stablecoins (USDT, USDC, DAI, USDe) as transfer vehicles',
    href: '/reports/crypto-stablecoin-analysis',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'emerald',
    status: 'coming-soon'
  }
];

const colorClasses = {
  blue: { bg: 'from-blue-500 to-blue-600', border: 'hover:border-blue-500', text: 'text-blue-500' },
  green: { bg: 'from-green-500 to-green-600', border: 'hover:border-green-500', text: 'text-green-500' },
  indigo: { bg: 'from-indigo-500 to-indigo-600', border: 'hover:border-indigo-500', text: 'text-indigo-500' },
  emerald: { bg: 'from-emerald-500 to-emerald-600', border: 'hover:border-emerald-500', text: 'text-emerald-500' },
  purple: { bg: 'from-purple-500 to-purple-600', border: 'hover:border-purple-500', text: 'text-purple-500' },
  orange: { bg: 'from-orange-500 to-orange-600', border: 'hover:border-orange-500', text: 'text-orange-500' }
};

export default function CryptoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ₿ Crypto Reports
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Cryptocurrency Trading Analysis vs Bitcoin
          </p>
          <p className="text-sm text-gray-500">
            27 Symbols • 24/7 Trading • 2 Baseline Methods • 18 Months History
          </p>
        </div>

        {/* Crypto List */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Cryptocurrencies</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {['ETH', 'USDT', 'XRP', 'BNB', 'SOL', 'USDC', 'TRX', 'DOGE', 'ADA', 'HYPE', 'LINK', 'BCH', 'XLM', 'USDe', 'LEO', 'SUI', 'HBAR', 'AVAX', 'LTC', 'ZEC', 'XMR', 'SHIB', 'TON', 'DAI', 'CRO', 'TAO', 'DOT'].map(symbol => (
              <div key={symbol} className="px-3 py-2 bg-gray-100 rounded text-center text-sm font-medium text-gray-700">
                {symbol}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            * Includes stablecoins (USDT, USDC, DAI, USDe) for low-fee transfer strategies
          </p>
        </div>

        {/* Report Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {CRYPTO_REPORTS.map((report) => {
            const colors = colorClasses[report.color as keyof typeof colorClasses];
            const isComingSoon = report.status === 'coming-soon';
            
            return (
              <Link key={report.href} href={isComingSoon ? '#' : report.href}>
                <div className={`bg-white rounded-lg shadow-lg p-6 transition-all cursor-pointer border-2 border-transparent ${isComingSoon ? 'opacity-60' : `hover:shadow-xl ${colors.border}`} relative`}>
                  {isComingSoon && (
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                        Coming Soon
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center mb-4">
                    <div className={`bg-gradient-to-br ${colors.bg} text-white rounded-full p-3 mr-4`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{report.title}</h2>
                  </div>
                  <p className="text-gray-600 text-sm">
                    {report.description}
                  </p>
                  {!isComingSoon && (
                    <div className={`mt-4 ${colors.text} font-semibold text-sm`}>
                      View Report →
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* System Info */}
        <div className="mt-12 max-w-4xl mx-auto bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">About Crypto Trading System</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>24/7 Trading:</strong> Crypto markets never close - signals generated continuously</p>
            <p>• <strong>2 Methods:</strong> EQUAL_MEAN (simple average) and WINSORIZED (outlier-resistant)</p>
            <p>• <strong>900 Combinations:</strong> 30 buy thresholds × 30 sell thresholds per method</p>
            <p>• <strong>Stablecoin Strategy:</strong> Use USDT, USDC, DAI, or USDe for low-fee transfers between positions</p>
            <p>• <strong>Data Source:</strong> Polygon API with 18 months of minute-by-minute data</p>
          </div>
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