'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/admin');
      }
    });
    return () => { listener.subscription.unsubscribe(); };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    if (isSignUp) {
      // Sign up logic
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`
        }
      });
      
      if (error) {
        console.error('Signup error:', error);
        setError(error.message);
      } else {
        setSuccess('Check your email for confirmation link!');
      }
      setLoading(false);
    } else {
      // Sign in logic  
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please confirm your email first');
        } else {
          setError(error.message);
        }
        setLoading(false);
      } else if (data?.user) {
        router.push('/admin');
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Back button */}
      <div className="p-6">
        <Link href="/" className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <div className="bg-zinc-800 rounded-2xl p-8 shadow-xl">
            {/* Header with tabs */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-amber-400 mb-6">Staff Portal</h1>
              
              {/* Sign In / Sign Up Tabs */}
              <div className="flex bg-zinc-700 rounded-xl p-1 mb-6">
                <button
                  onClick={() => { setIsSignUp(false); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    !isSignUp ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setIsSignUp(true); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    isSignUp ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-6">
                <p className="text-green-400 text-sm text-center">{success}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="staff@netrikxr.shop"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Enter your password"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>

              {/* Confirm Password (only for signup) */}
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="Confirm your password"
                    required
                    autoComplete="new-password"
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black px-6 py-3.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>{isSignUp ? 'CREATE ACCOUNT' : 'LOGIN'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            {!isSignUp && (
              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">Forgot password? Contact administrator</p>
              </div>
            )}
            
            {isSignUp && (
              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">
                  By creating an account, you agree to our terms of service.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
