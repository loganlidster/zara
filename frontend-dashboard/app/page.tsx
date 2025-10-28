'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Tradiac Event Dashboard
          </h1>
          <p className="text-xl text-gray-600">
            Event-based trading analysis powered by real-time data
          </p>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          
          {/* Fast Daily Report */}
          <Link href="/reports/fast-daily">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
              <div className="flex items-center mb-4">
                <div className="bg-blue-500 text-white rounded-full p-3 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Fast Daily</h2>
              </div>
              <p className="text-gray-600">
                Single simulation report showing all BUY/SELL events with detailed performance metrics
              </p>
              <div className="mt-4 text-blue-500 font-semibold">
                View Report →
              </div>
            </div>
          </Link>

          {/* Best Performers */}
          <Link href="/reports/best-performers">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
              <div className="flex items-center mb-4">
                <div className="bg-green-500 text-white rounded-full p-3 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Best Performers</h2>
              </div>
              <p className="text-gray-600">
                Find the most profitable buy/sell combinations with win rates and average ROI
              </p>
              <div className="mt-4 text-green-500 font-semibold">
                View Report →
              </div>
            </div>
          </Link>

          {/* Method Comparison */}
          <Link href="/reports/method-comparison">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500">
              <div className="flex items-center mb-4">
                <div className="bg-purple-500 text-white rounded-full p-3 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Method Comparison</h2>
              </div>
              <p className="text-gray-600">
                Compare all 5 baseline methods side-by-side to find the best strategy
              </p>
              <div className="mt-4 text-purple-500 font-semibold">
                View Report →
              </div>
            </div>
          </Link>

          {/* Session Analysis */}
          <Link href="/reports/session-analysis">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-orange-500">
              <div className="flex items-center mb-4">
                <div className="bg-orange-500 text-white rounded-full p-3 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Session Analysis</h2>
              </div>
              <p className="text-gray-600">
                Compare RTH vs AH performance to optimize trading hours
              </p>
              <div className="mt-4 text-orange-500 font-semibold">
                View Report →
              </div>
            </div>
          </Link>

          {/* Trade Analysis */}
          <Link href="/reports/trade-analysis">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-red-500">
              <div className="flex items-center mb-4">
                <div className="bg-red-500 text-white rounded-full p-3 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Trade Analysis</h2>
              </div>
              <p className="text-gray-600">
                Deep dive into trade statistics, win rates, and profit distribution
              </p>
              <div className="mt-4 text-red-500 font-semibold">
                View Report →
              </div>
            </div>
          </Link>

          {/* BTC Impact */}
          <Link href="/reports/btc-impact">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-yellow-500">
              <div className="flex items-center mb-4">
                <div className="bg-yellow-500 text-white rounded-full p-3 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">BTC Impact</h2>
              </div>
              <p className="text-gray-600">
                Analyze how Bitcoin price levels affect trading decisions and outcomes
              </p>
              <div className="mt-4 text-yellow-500 font-semibold">
                View Report →
              </div>
            </div>
          </Link>

        </div>

        {/* Stats Summary */}
        <div className="mt-12 bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            System Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">11</div>
              <div className="text-gray-600 mt-2">Symbols</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">5</div>
              <div className="text-gray-600 mt-2">Methods</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-500">900</div>
              <div className="text-gray-600 mt-2">Combinations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-500">49.5K</div>
              <div className="text-gray-600 mt-2">Simulations</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600">
          <p>Event-based trading analysis • Real-time data from Google Cloud SQL</p>
        </div>
      </div>
    </div>
  );
}