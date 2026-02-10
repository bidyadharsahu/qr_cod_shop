'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen min-h-dvh relative overflow-hidden">
      <div className="luxury-bg" />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen min-h-dvh px-6 py-12 safe-top safe-bottom">
        {/* Logo */}
        <div className={`mb-8 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
            <span className="text-5xl">🥂</span>
          </div>
        </div>

        {/* Title */}
        <div className={`text-center mb-8 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-4xl font-bold mb-3 gold-text">
            netrikxr.shop
          </h1>
          <p className="text-gray-400 text-lg">
            Luxury Drinks • Premium Service
          </p>
        </div>

        {/* Decorative line */}
        <div className={`w-32 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-8 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} />

        {/* Welcome message */}
        <div className={`glass-card gold-card p-6 max-w-sm w-full text-center mb-8 transition-all duration-1000 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-gray-300 leading-relaxed">
            Welcome to an exclusive experience. Scan the QR code on your table to begin your premium ordering journey.
          </p>
        </div>

        {/* Features */}
        <div className={`grid grid-cols-3 gap-4 max-w-sm w-full mb-10 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {[
            { icon: '📱', label: 'Scan' },
            { icon: '💬', label: 'Order' },
            { icon: '🥂', label: 'Enjoy' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-[#1a1a1a] border border-[#d4af37]/20 flex items-center justify-center text-2xl">
                {item.icon}
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className={`text-center max-w-xs transition-all duration-1000 delay-600 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-gray-500 text-sm italic">
            "Life is too short for ordinary drinks"
          </p>
        </div>

        {/* Admin link - subtle */}
        <div className={`absolute bottom-8 transition-all duration-1000 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <Link href="/admin" className="text-gray-600 text-xs hover:text-[#d4af37] transition-colors">
            Staff Access
          </Link>
        </div>
      </div>
    </main>
  );
}
