'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ADMIN_SESSION_KEYS } from '@/lib/tenant';

const DEFAULT_SUPER_ADMIN_USERNAME = 'owner';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'owner123';

export default function CentralAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(ADMIN_SESSION_KEYS.centralAdminAuthenticated) === 'true') {
      router.push('/central');
    }
  }, [router]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    await new Promise(resolve => setTimeout(resolve, 300));

    const expectedUser = process.env.NEXT_PUBLIC_CENTRAL_ADMIN_USERNAME || DEFAULT_SUPER_ADMIN_USERNAME;
    const expectedPassword = process.env.NEXT_PUBLIC_CENTRAL_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD;

    if (username.trim() !== expectedUser || password !== expectedPassword) {
      setError('Invalid central admin credentials.');
      setLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_SESSION_KEYS.centralAdminAuthenticated, 'true');
      window.sessionStorage.setItem(ADMIN_SESSION_KEYS.centralAdminUser, username.trim());
    }

    router.push('/central');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-7 shadow-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Central Admin</h1>
            <p className="text-xs text-zinc-400">Platform owner access</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2.5 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in to Central Admin'}
          </button>
        </form>

        <p className="mt-5 text-xs text-zinc-500">
          Restaurant team login is available at <Link href="/admin/login" className="text-amber-400 hover:text-amber-300">/admin/login</Link>
        </p>
      </div>
    </div>
  );
}
