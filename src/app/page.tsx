'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-slate-800 mb-4">
          netrikxr.shop
        </h1>
        <p className="text-slate-500 text-lg mb-12">
          Manage your restaurant effectively
        </p>
        
        <Link 
          href="/admin/login"
          className="inline-block px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
        >
          Staff Login
        </Link>
      </div>
    </main>
  );
}
