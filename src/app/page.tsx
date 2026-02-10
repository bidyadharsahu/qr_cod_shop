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
            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className={`text-center mb-8 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-4xl font-bold mb-3 gold-text">
            netrikxr.shop
          </h1>
          <p className="text-gray-400 text-lg tracking-wide">
            Premium Digital Ordering
          </p>
        </div>

        {/* Decorative line */}
        <div className={`w-32 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-8 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} />

        {/* Welcome message */}
        <div className={`glass-card gold-card p-8 max-w-sm w-full text-center mb-10 transition-all duration-1000 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-lg font-semibold text-white mb-3">Welcome</h2>
          <p className="text-gray-300 leading-relaxed text-sm">
            Scan the QR code on your table to start ordering. Our digital server will guide you through the menu and take care of everything.
          </p>
        </div>

        {/* How it works - clean steps with icons, no emojis */}
        <div className={`max-w-sm w-full mb-10 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center justify-between gap-2">
            {[
              { step: '1', label: 'Scan QR', icon: <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg> },
              { step: '2', label: 'Order via Chat', icon: <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
              { step: '3', label: 'Sit Back', icon: <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            ].map((item, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full border border-[#d4af37]/40 flex items-center justify-center">
                  {item.icon}
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center mt-[-28px] mb-6 px-[20%] -z-10 relative">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent" />
          </div>
        </div>

        {/* Location */}
        <div className={`text-center max-w-xs transition-all duration-1000 delay-600 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-gray-600 text-xs uppercase tracking-widest">
            Tampa, Florida
          </p>
        </div>

        {/* Staff Access */}
        <div className={`absolute bottom-8 transition-all duration-1000 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <Link href="/admin/login" className="text-gray-600 text-xs hover:text-[#d4af37] transition-colors">
            Staff Access
          </Link>
        </div>
      </div>
    </main>
  );
}
