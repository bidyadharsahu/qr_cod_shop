'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { 
  Mail, Lock, Eye, EyeOff, LogIn, UserPlus, 
  KeyRound, ArrowLeft, AlertCircle, CheckCircle, Loader2, Sparkles
} from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
      if (event === 'SIGNED_IN' && mode !== 'reset') {
        router.push('/admin');
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, [router, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/admin');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/login`,
      }
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email to confirm your account!');
      setMode('login');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/login`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset link sent to your email. Check your inbox.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Password updated successfully! Redirecting...');
      setTimeout(() => router.push('/admin'), 2000);
    }
    setLoading(false);
  };

  const clearMessages = () => {
    setError('');
    setMessage('');
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'login': return <LogIn className="w-10 h-10 text-black" />;
      case 'signup': return <UserPlus className="w-10 h-10 text-black" />;
      case 'forgot': return <Mail className="w-10 h-10 text-black" />;
      case 'reset': return <KeyRound className="w-10 h-10 text-black" />;
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
      case 'reset': return 'New Password';
    }
  };

  return (
    <main className="min-h-screen min-h-dvh relative overflow-hidden bg-black flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="fixed inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-900/10 rounded-full blur-[180px]" />
      </div>
      
      {/* Grid pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(212,175,55,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Floating decorative elements */}
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-20 w-16 h-16 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-2xl backdrop-blur-sm border border-amber-500/20 hidden lg:flex items-center justify-center"
      >
        <Sparkles className="w-8 h-8 text-amber-500/50" />
      </motion.div>
      
      <motion.div
        animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-32 left-20 w-20 h-20 bg-gradient-to-br from-amber-400/10 to-amber-600/5 rounded-3xl backdrop-blur-sm border border-amber-500/10 hidden lg:flex items-center justify-center"
      >
        <Lock className="w-10 h-10 text-amber-500/40" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-8"
        >
          <Link href="/" className="inline-block">
            <div className="relative mx-auto mb-6">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-amber-500 rounded-full blur-xl opacity-30"
              />
              <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/30 border border-amber-400/40">
                {getModeIcon()}
              </div>
            </div>
          </Link>
          <motion.h1 
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold mb-2"
          >
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              {getModeTitle()}
            </span>
          </motion.h1>
          <p className="text-gray-500 text-sm">netrikxr.shop Admin Portal</p>
        </motion.div>

        {/* Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent rounded-3xl blur-xl opacity-50" />
          <div className="relative bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 backdrop-blur-xl rounded-3xl p-8 border border-amber-700/20 shadow-2xl">
            
            <AnimatePresence mode="wait">
              {/* Login Form */}
              {mode === 'login' && (
                <motion.form 
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleLogin} 
                  className="space-y-5"
                >
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="admin@example.com" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="Enter password" 
                        required 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-amber-500 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                    
                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        {message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <motion.button 
                    type="submit" 
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        Sign In
                      </>
                    )}
                  </motion.button>
                  
                  <div className="flex justify-between text-sm pt-2">
                    <button 
                      type="button" 
                      onClick={() => { setMode('forgot'); clearMessages(); }} 
                      className="text-gray-400 hover:text-amber-500 transition-colors"
                    >
                      Forgot Password?
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setMode('signup'); clearMessages(); }} 
                      className="text-amber-500 hover:text-amber-400 transition-colors font-medium"
                    >
                      Create Account
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Sign Up Form */}
              {mode === 'signup' && (
                <motion.form 
                  key="signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSignUp} 
                  className="space-y-5"
                >
                  <p className="text-gray-400 text-sm text-center mb-4">Create your admin account to get started</p>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="admin@example.com" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="Minimum 6 characters" 
                        required 
                        minLength={6}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">Confirm Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="Confirm your password" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        {message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <motion.button 
                    type="submit" 
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Create Account
                      </>
                    )}
                  </motion.button>
                  
                  <button 
                    type="button" 
                    onClick={() => { setMode('login'); clearMessages(); }} 
                    className="w-full text-center text-gray-400 text-sm hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </button>
                </motion.form>
              )}

              {/* Forgot Password Form */}
              {mode === 'forgot' && (
                <motion.form 
                  key="forgot"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleForgotPassword} 
                  className="space-y-5"
                >
                  <p className="text-gray-400 text-sm text-center">Enter your email to receive a password reset link</p>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="admin@example.com" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        {message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <motion.button 
                    type="submit" 
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Send Reset Link
                      </>
                    )}
                  </motion.button>
                  
                  <button 
                    type="button" 
                    onClick={() => { setMode('login'); clearMessages(); }} 
                    className="w-full text-center text-gray-400 text-sm hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </button>
                </motion.form>
              )}

              {/* Reset Password Form */}
              {mode === 'reset' && (
                <motion.form 
                  key="reset"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleResetPassword} 
                  className="space-y-5"
                >
                  <p className="text-gray-400 text-sm text-center">Enter your new password</p>
                  
                  <div>
                    <label className="text-sm text-gray-400 block mb-2 font-medium">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="w-5 h-5 text-gray-500" />
                      </div>
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        className="w-full bg-zinc-800/50 border border-amber-700/20 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        placeholder="Minimum 6 characters" 
                        required 
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-amber-500 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        {message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <motion.button 
                    type="submit" 
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-5 h-5" />
                        Update Password
                      </>
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Back to home */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-gray-500 text-sm hover:text-amber-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
