'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
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
      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
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

        {/* Staff Login Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/admin/login"
              className="group relative bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black px-12 py-4 rounded-xl text-lg font-semibold shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-3 overflow-hidden border border-amber-400/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <LogIn className="w-6 h-6 relative z-10" />
              <span className="relative z-10 tracking-wide">STAFF LOGIN</span>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
