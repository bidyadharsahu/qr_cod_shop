'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Utensils, QrCode, CreditCard, MessageCircle, LogIn } from 'lucide-react';

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

      {/* Floating orbs */}
      <motion.div 
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-600/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.15, 0.1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 rounded-2xl flex items-center justify-center shadow-2xl border border-amber-400/30">
              <Utensils className="w-10 h-10 text-black" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mb-10"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent tracking-tight">
            netrikxr.shop
          </h1>
          
          <motion.div
            className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-amber-400 to-transparent mb-6"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
          />
          
          <p className="text-lg md:text-xl text-gray-400 max-w-md mx-auto font-light">
            Premium QR Code Ordering System for Modern Restaurants
          </p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mb-12 w-full px-4"
        >
          {[
            { icon: QrCode, title: 'Scan QR', desc: 'Quick table ordering' },
            { icon: MessageCircle, title: 'AI Chatbot', desc: 'Smart waiter assistant' },
            { icon: CreditCard, title: 'Easy Pay', desc: 'Online or cash payment' },
            { icon: Utensils, title: 'Live Menu', desc: 'Real-time updates' },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              className="group bg-gradient-to-br from-amber-900/10 to-black/50 backdrop-blur-xl border border-amber-700/20 rounded-2xl p-6 hover:border-amber-500/40 transition-all duration-300"
              whileHover={{ scale: 1.02, y: -5 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
            >
              <feature.icon className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="text-base font-semibold text-amber-100 mb-1">{feature.title}</h3>
              <p className="text-xs text-gray-500">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/admin/login"
              className="group relative bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black px-10 py-4 rounded-xl text-base font-semibold shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-3 overflow-hidden border border-amber-400/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <LogIn className="w-5 h-5 relative z-10" />
              <span className="relative z-10 tracking-wide">STAFF LOGIN</span>
            </Link>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/order?table=1"
              className="bg-white/5 backdrop-blur-xl border border-white/10 text-white px-10 py-4 rounded-xl text-base font-semibold flex items-center justify-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <QrCode className="w-5 h-5" />
              <span className="tracking-wide">TRY DEMO</span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div 
          className="absolute bottom-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <p className="text-gray-600 text-sm">© 2026 netrikxr.shop • Tampa, Florida</p>
        </motion.div>
      </div>
    </div>
  );
}
