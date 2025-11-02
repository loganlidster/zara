'use client';

import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen relative bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Logo Watermark Background */}
      <div 
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'url(/RAAS_primary_transparent_512.png)',
          backgroundSize: '400px 400px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <Header />
      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <img 
              src="/RAAS_primary_transparent_512.png" 
              alt="RAAS Logo" 
              className="h-32 w-32"
            />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            RAAS Tracking System
          </h1>
          <p className="text-xl text-gray-600">
            Really Amazing Asset Tracking - Event-based trading analysis powered by real-time data
          </p>
        </div>

        {/* Two Main Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* STOCKS Section */}
          <Link href="/stocks">
            <div className="bg-white rounded-2xl shadow-2xl p-8 hover:shadow-3xl transition-all cursor-pointer border-4 border-transparent hover:border-blue-500 transform hover:scale-105">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full p-6">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                📈 STOCKS
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                Bitcoin Mining Stocks
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Symbols:</span>
                  <span className="font-semibold text-gray-900">9 Mining Stocks</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Trading:</span>
                  <span className="font-semibold text-gray-900">RTH & AH Sessions</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Methods:</span>
                  <span className="font-semibold text-gray-900">5 Baseline Methods</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Data:</span>
                  <span className="font-semibold text-gray-900">33M+ Events</span>
                </div>
              </div>
              
              <div className="text-center">
                <span className="inline-block px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg">
                  View Stock Reports →
                </span>
              </div>
            </div>
          </Link>

          {/* CRYPTO Section */}
          <Link href="/crypto">
            <div className="bg-white rounded-2xl shadow-2xl p-8 hover:shadow-3xl transition-all cursor-pointer border-4 border-transparent hover:border-orange-500 transform hover:scale-105">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-full p-6">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                ₿ CRYPTO
              </h2>
              
              <p className="text-gray-600 text-center mb-6">
                Cryptocurrencies vs Bitcoin
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Symbols:</span>
                  <span className="font-semibold text-gray-900">27 Cryptocurrencies</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Trading:</span>
                  <span className="font-semibold text-gray-900">24/7 Continuous</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Methods:</span>
                  <span className="font-semibold text-gray-900">2 Baseline Methods</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Data:</span>
                  <span className="font-semibold text-gray-900">18 Months History</span>
                </div>
              </div>
              
              <div className="text-center">
                <span className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg">
                  View Crypto Reports →
                </span>
              </div>
            </div>
          </Link>

        </div>

        {/* Feature Highlights */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
            System Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Real-Time Analysis</h4>
              <p className="text-sm text-gray-600">Live data processing with minute-by-minute precision</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Multiple Strategies</h4>
              <p className="text-sm text-gray-600">Test 900+ buy/sell combinations across multiple methods</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Performance Tracking</h4>
              <p className="text-sm text-gray-600">Detailed ROI, win rates, and trade analysis</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}