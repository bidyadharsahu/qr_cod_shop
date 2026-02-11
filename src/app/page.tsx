'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-black">N</span>
            </div>
            <span className="text-xl font-bold">netrikxr.shop</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/admin/login" 
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Admin Login
            </Link>
            <Link 
              href="/admin" 
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm mb-6">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                Smart Restaurant Ordering
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
                QR Code
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500"> Ordering </span>
                System
              </h1>
              <p className="text-xl text-gray-400 mb-8 leading-relaxed">
                Transform your restaurant with AI-powered chatbot ordering. Customers scan, order, and pay - all from their phone.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link 
                  href="/admin/login" 
                  className="px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Get Started
                </Link>
                <Link 
                  href="/order?table=1" 
                  className="px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Demo
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-500/20 blur-3xl rounded-full"></div>
              <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold shrink-0">N</div>
                    <div className="bg-gray-700/50 rounded-2xl rounded-tl-sm p-4 max-w-xs">
                      <p className="text-sm">Welcome to Table 5! I&apos;m your AI waiter. What would you like to order today?</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-amber-500/20 rounded-2xl rounded-tr-sm p-4 max-w-xs">
                      <p className="text-sm text-amber-200">I&apos;d like a Mojito and some appetizers please</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center shrink-0">👤</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-black font-bold shrink-0">N</div>
                    <div className="bg-gray-700/50 rounded-2xl rounded-tl-sm p-4 max-w-xs">
                      <p className="text-sm">Great choice! I&apos;ve added Mojito ($9) to your cart. Browse our menu below!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-black/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Simple 4-step process for seamless ordering</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Scan QR Code', desc: 'Customer scans the QR code placed on their table', icon: '📱' },
              { step: '02', title: 'Chat & Order', desc: 'AI chatbot assists with menu browsing and ordering', icon: '💬' },
              { step: '03', title: 'Confirm Order', desc: 'Admin receives and confirms the order instantly', icon: '✅' },
              { step: '04', title: 'Pay & Enjoy', desc: 'Pay via chatbot or cash - order details sent to WhatsApp', icon: '💳' },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/20 to-orange-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-6 border border-white/5 hover:border-amber-500/30 transition-colors h-full">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <div className="text-amber-400 text-sm font-mono mb-2">Step {item.step}</div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-gray-400 text-lg">Everything you need to run a modern restaurant</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'QR Code Generation', desc: 'Auto-generate unique QR codes for each table', icon: '🔳' },
              { title: 'Real-time Orders', desc: 'Instant order notifications to admin dashboard', icon: '⚡' },
              { title: 'AI Chatbot Waiter', desc: 'Smart chatbot handles ordering like a human waiter', icon: '🤖' },
              { title: 'Table Management', desc: 'Track table status: available, booked, or occupied', icon: '🪑' },
              { title: 'Menu Management', desc: 'Easy add, edit, or remove menu items', icon: '📋' },
              { title: 'Payment Tracking', desc: 'Track cash and online payments separately', icon: '💰' },
            ].map((feature, i) => (
              <div key={i} className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-xl p-6 border border-white/5 hover:border-amber-500/20 transition-colors">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/30 to-orange-500/30 blur-3xl rounded-3xl"></div>
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-12 border border-amber-500/20 text-center">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to Transform Your Restaurant?</h2>
              <p className="text-gray-400 text-lg mb-8">Start accepting orders through QR codes today</p>
              <Link 
                href="/admin/login" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Access Admin Dashboard
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-black">N</span>
            </div>
            <span className="font-semibold">netrikxr.shop</span>
          </div>
          <p className="text-gray-500 text-sm">© 2026 netrikxr.shop. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
