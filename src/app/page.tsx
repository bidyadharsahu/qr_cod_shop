'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { LogIn, Zap, Eye, QrCode, MessageSquare, CreditCard, Users, ClipboardList, DollarSign } from 'lucide-react';

// Animated Mockup Component
function AnimatedAppMockup() {
  return (
    <div className="relative w-full max-w-6xl h-[600px]">
      {/* Floating App Screenshots */}
      <motion.div
        className="absolute top-10 left-10 w-72 h-96 rounded-xl shadow-2xl overflow-hidden border border-amber-700/30"
        animate={{
          y: [0, -20, 0],
          rotate: [-2, 2, -2],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="bg-gradient-to-br from-zinc-900 to-black h-full p-6 border border-amber-600/20">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-amber-700/20">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg"></div>
            <div>
              <div className="h-3 w-24 bg-amber-400/30 rounded mb-2"></div>
              <div className="h-2 w-16 bg-amber-400/20 rounded"></div>
            </div>
          </div>
          
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gradient-to-r from-amber-900/20 to-amber-800/10 p-4 rounded-lg border border-amber-700/20 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-3 w-20 bg-amber-400/40 rounded"></div>
                  <div className="h-6 w-16 bg-gradient-to-r from-amber-500 to-amber-600 rounded shadow-lg"></div>
                </div>
                <div className="h-2 w-full bg-amber-400/20 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Second Floating Screenshot */}
      <motion.div
        className="absolute top-32 right-10 w-80 h-[420px] rounded-xl shadow-2xl overflow-hidden border border-amber-700/30"
        animate={{
          y: [0, 20, 0],
          rotate: [2, -2, 2],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      >
        <div className="bg-gradient-to-br from-zinc-900 to-black h-full p-6 border border-amber-600/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full mx-auto mb-4"></div>
            <div className="h-4 w-32 bg-amber-400/30 rounded mx-auto mb-2"></div>
            <div className="h-3 w-24 bg-amber-400/20 rounded mx-auto"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-amber-900/10 border border-amber-700/20">
                <div className="w-12 h-12 bg-amber-500/30 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3 w-full bg-amber-400/30 rounded mb-2"></div>
                  <div className="h-2 w-2/3 bg-amber-400/20 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Third Floating Element */}
      <motion.div
        className="absolute bottom-10 left-1/3 w-64 h-80 rounded-xl shadow-2xl overflow-hidden border border-amber-700/30"
        animate={{
          y: [0, -15, 0],
          rotate: [-3, 3, -3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      >
        <div className="bg-gradient-to-br from-zinc-900 to-black h-full p-6 flex flex-col border border-amber-600/20">
          <div className="mb-6 pb-4 border-b border-amber-700/20">
            <div className="h-4 w-32 bg-amber-400/40 rounded mb-2"></div>
            <div className="h-3 w-24 bg-amber-400/20 rounded"></div>
          </div>
          
          <div className="flex-1 bg-amber-900/10 rounded-lg backdrop-blur-sm p-4 border border-amber-700/20">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-amber-800/20 rounded-lg h-20 border border-amber-700/30"></div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Luxury gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-black to-amber-900/20"></div>
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="h-full w-full" style={{
          backgroundImage: 'linear-gradient(rgba(251, 191, 36, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(251, 191, 36, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Background Animation */}
      <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
        <AnimatedAppMockup />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-amber-700/20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-xl font-bold text-black">N</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">netrikxr.shop</span>
            </motion.div>
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link 
                href="/admin/login" 
                className="px-4 py-2 text-sm text-gray-300 hover:text-amber-400 transition-colors"
              >
                Admin Login
              </Link>
              <Link 
                href="/admin" 
                className="px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-medium rounded-lg transition-all shadow-lg shadow-amber-500/20"
              >
                Dashboard
              </Link>
            </motion.div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-32">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <motion.h1
              className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent tracking-tight"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              netrikxr.shop
            </motion.h1>
            
            <motion.div
              className="h-px w-64 mx-auto bg-gradient-to-r from-transparent via-amber-400 to-transparent mb-8"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            />
            
            <motion.p
              className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto font-light tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              QR Code Ordering System for Modern Restaurants
            </motion.p>
          </motion.div>

          {/* Features Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <motion.div
              className="bg-gradient-to-br from-amber-900/10 to-black border border-amber-700/30 backdrop-blur-sm rounded-lg p-8 shadow-2xl hover:border-amber-500/50 transition-all duration-300"
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <ClipboardList className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-amber-100">Orders Management</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Track and manage orders in real-time with intelligent workflow automation</p>
            </motion.div>
            
            <motion.div
              className="bg-gradient-to-br from-amber-900/10 to-black border border-amber-700/30 backdrop-blur-sm rounded-lg p-8 shadow-2xl hover:border-amber-500/50 transition-all duration-300"
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <Users className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-amber-100">Staff Coordination</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Coordinate your team efficiently with streamlined communication tools</p>
            </motion.div>
            
            <motion.div
              className="bg-gradient-to-br from-amber-900/10 to-black border border-amber-700/30 backdrop-blur-sm rounded-lg p-8 shadow-2xl hover:border-amber-500/50 transition-all duration-300"
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <DollarSign className="w-8 h-8 text-amber-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-amber-100">Business Analytics</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Actionable insights to grow your business with data-driven decisions</p>
            </motion.div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/admin/login"
                className="relative bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black px-12 py-4 rounded-lg text-base font-semibold shadow-2xl flex items-center gap-3 overflow-hidden group border border-amber-400/50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <LogIn className="w-5 h-5 relative z-10" />
                <span className="relative z-10 tracking-wide">STAFF LOGIN</span>
              </Link>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/order?table=1"
                className="relative bg-transparent border-2 border-amber-500/50 text-amber-400 px-12 py-4 rounded-lg text-base font-semibold shadow-2xl flex items-center gap-3 overflow-hidden hover:bg-amber-500/10 transition-all duration-300"
              >
                <Eye className="w-5 h-5" />
                <span className="tracking-wide">VIEW DEMO</span>
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 bg-black/50 border-t border-amber-700/20">
          <div className="max-w-7xl mx-auto">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-4 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">How It Works</h2>
              <p className="text-gray-400 text-lg">Simple 4-step process for seamless ordering</p>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { step: '01', title: 'Scan QR Code', desc: 'Customer scans the QR code placed on their table', Icon: QrCode },
                { step: '02', title: 'Chat & Order', desc: 'AI chatbot assists with menu browsing and ordering', Icon: MessageSquare },
                { step: '03', title: 'Confirm Order', desc: 'Admin receives and confirms the order instantly', Icon: Zap },
                { step: '04', title: 'Pay & Enjoy', desc: 'Pay via chatbot or cash - order details sent to WhatsApp', Icon: CreditCard },
              ].map((item, idx) => (
                <motion.div 
                  key={item.step} 
                  className="relative group"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/20 to-orange-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-zinc-900/80 to-black rounded-2xl p-6 border border-amber-700/30 hover:border-amber-500/50 transition-colors h-full">
                    <item.Icon className="w-10 h-10 text-amber-400 mb-4" />
                    <div className="text-amber-400 text-sm font-mono mb-2">Step {item.step}</div>
                    <h3 className="text-xl font-semibold mb-2 text-amber-100">{item.title}</h3>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 border-t border-amber-700/20 bg-black/60">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-black">N</span>
              </div>
              <span className="font-semibold text-amber-100">netrikxr.shop</span>
            </div>
            <p className="text-gray-500 text-sm">© 2026 netrikxr.shop. All rights reserved. Tampa, FL USA</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
