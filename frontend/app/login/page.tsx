'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession, type User } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [tenant, setTenant] = useState(useSession.getState().tenant);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST', tenant,
        body: JSON.stringify({ username: f.get('username'), password: f.get('password') }),
      });
      signIn(r.token, tenant, r.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally { setBusy(false); }
  }

  const input = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6" noValidate>
        <h1 className="text-xl font-bold">Sign in to MobiFlow</h1>
        {error && (
          <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error.message}
            {error.problem.trace_id && error.problem.status >= 500 && (
              <div className="mt-1 text-xs opacity-80">Reference: {error.problem.trace_id}</div>
            )}
          </div>
        )}
        <label className="block text-sm">Shop code
          <input className={input} value={tenant} onChange={(e) => setTenant(e.target.value)} autoCapitalize="none" required />
        </label>
        <label className="block text-sm">Username
          <input name="username" className={input} autoComplete="username" required />
          {error?.field('username') && <span className="text-xs text-danger">{error.field('username')}</span>}
        </label>
        <label className="block text-sm">Password
          <input name="password" type="password" className={input} autoComplete="current-password" required />
        </label>
        <button disabled={busy} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-muted">New shop? <a href="/register" className="text-primary">Start free trial</a></p>
      </form>
    </main>
  );
}
