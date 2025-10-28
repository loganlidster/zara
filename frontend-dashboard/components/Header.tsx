'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <img 
            src="/RAAS_primary_transparent_128.png" 
            alt="RAAS Logo" 
            className="h-10 w-10"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            RAAS Tracking System
          </h1>
        </Link>
        
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}