'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    
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

  return (
    <main className="min-h-screen min-h-dvh relative overflow-hidden bg-[#030303] flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#d4af37]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="relative mx-auto mb-6">
              <div className="absolute inset-0 bg-[#d4af37] rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#f4e4bc] via-[#d4af37] to-[#996515] flex items-center justify-center shadow-xl shadow-[#d4af37]/20 border border-[#d4af37]/40">
                <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            </div>
          </Link>
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#996515] bg-clip-text text-transparent">
              {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'New Password'}
            </span>
          </h1>
          <p className="text-gray-500 text-sm">netrikxr.shop Admin Portal</p>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/20 to-transparent rounded-3xl blur-xl opacity-50" />
          <div className="relative bg-gradient-to-br from-[#1a1a1a]/95 to-[#0d0d0d]/95 backdrop-blur-xl rounded-3xl p-8 border border-[#d4af37]/20 shadow-2xl">
            
            {/* Login Form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                      placeholder="admin@example.com" 
                      required 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                      placeholder="Enter password" 
                      required 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-[#d4af37] transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    {error}
                  </div>
                )}
                
                {message && (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {message}
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#996515] hover:shadow-lg hover:shadow-[#d4af37]/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </button>
                
                <div className="flex justify-between text-sm pt-2">
                  <button 
                    type="button" 
                    onClick={() => { setMode('forgot'); clearMessages(); }} 
                    className="text-gray-400 hover:text-[#d4af37] transition-colors"
                  >
                    Forgot Password?
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setMode('signup'); clearMessages(); }} 
                    className="text-[#d4af37] hover:text-[#f4e4bc] transition-colors font-medium"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            )}

            {/* Sign Up Form */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-5">
                <p className="text-gray-400 text-sm text-center mb-4">Create your admin account to get started</p>
                
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                    placeholder="admin@example.com" 
                    required 
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">Password</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                    placeholder="Minimum 6 characters" 
                    required 
                    minLength={6}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                    placeholder="Confirm your password" 
                    required 
                  />
                </div>
                
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
                )}
                {message && (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{message}</div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#996515] hover:shadow-lg hover:shadow-[#d4af37]/30 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => { setMode('login'); clearMessages(); }} 
                  className="w-full text-center text-gray-400 text-sm hover:text-[#d4af37] transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            )}

            {/* Forgot Password Form */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <p className="text-gray-400 text-sm text-center">Enter your email to receive a password reset link</p>
                
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                    placeholder="admin@example.com" 
                    required 
                  />
                </div>
                
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
                )}
                {message && (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{message}</div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#996515] hover:shadow-lg hover:shadow-[#d4af37]/30 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                
                <button 
                  type="button" 
                  onClick={() => { setMode('login'); clearMessages(); }} 
                  className="w-full text-center text-gray-400 text-sm hover:text-[#d4af37] transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            )}

            {/* Reset Password Form */}
            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <p className="text-gray-400 text-sm text-center">Enter your new password</p>
                
                <div>
                  <label className="text-sm text-gray-400 block mb-2 font-medium">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 rounded-xl py-3.5 px-4 text-white placeholder-gray-500 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/50 transition-all outline-none"
                    placeholder="Minimum 6 characters" 
                    required 
                    minLength={6}
                  />
                </div>
                
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
                )}
                {message && (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{message}</div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#996515] hover:shadow-lg hover:shadow-[#d4af37]/30 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-gray-500 text-sm hover:text-[#d4af37] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
