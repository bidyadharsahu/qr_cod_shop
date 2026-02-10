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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Account created! You can now sign in.');
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

  return (
    <main className="min-h-screen min-h-dvh relative overflow-hidden flex items-center justify-center">
      <div className="luxury-bg" />
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#d4af37] to-[#996515] flex items-center justify-center shadow-lg shadow-[#d4af37]/20 mb-4">
            <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold gold-text">Admin Access</h1>
          <p className="text-gray-500 text-sm mt-1">netrikxr.shop</p>
        </div>

        {/* Form Card */}
        <div className="gold-card p-6 rounded-2xl">
          {/* Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="luxury-input" placeholder="admin@example.com" required />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="luxury-input" placeholder="Enter password" required />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {message && <p className="text-green-400 text-sm">{message}</p>}
              <button type="submit" disabled={loading} className="luxury-btn w-full">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-[#d4af37] hover:underline">
                  Forgot Password?
                </button>
                <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className="text-[#d4af37] hover:underline">
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* Sign Up */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <p className="text-gray-400 text-sm text-center mb-2">Create your admin account</p>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="luxury-input" placeholder="admin@example.com" required />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="luxury-input" placeholder="Min 6 characters" required />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="luxury-input" placeholder="Confirm password" required />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {message && <p className="text-green-400 text-sm">{message}</p>}
              <button type="submit" disabled={loading} className="luxury-btn w-full">
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-[#d4af37] text-sm w-full text-center hover:underline">
                Back to Login
              </button>
            </form>
          )}

          {/* Forgot Password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-gray-400 text-sm text-center">Enter your email to receive a password reset link.</p>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="luxury-input" placeholder="admin@example.com" required />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {message && <p className="text-green-400 text-sm">{message}</p>}
              <button type="submit" disabled={loading} className="luxury-btn w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-[#d4af37] text-sm w-full text-center hover:underline">
                Back to Login
              </button>
            </form>
          )}

          {/* Reset Password */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-gray-400 text-sm text-center">Enter your new password.</p>
              <div>
                <label className="text-sm text-gray-400 block mb-2">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="luxury-input" placeholder="Min 6 characters" required minLength={6} />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {message && <p className="text-green-400 text-sm">{message}</p>}
              <button type="submit" disabled={loading} className="luxury-btn w-full">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-gray-600 text-xs hover:text-[#d4af37] transition-colors">
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
