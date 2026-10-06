'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { usePlatform } from '@/lib/platform';

export default function PlatformLogin() {
  const router = useRouter(); const signIn = usePlatform((s) => s.signIn);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setErr(null);
    try { const r = await api<{ token: string; admin: { name: string; email: string } }>('/platform/auth/login', { method: 'POST', body: JSON.stringify({ email: f.get('email'), password: f.get('password') }) });
      signIn(r.token, r.admin); router.replace('/platform'); }
    catch (x) { setErr(x instanceof ApiError ? x.message : 'Sign in failed.'); } finally { setBusy(false); }
  }
  const ctl = 'h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Platform sign in</h1>
        {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
        <label className="block text-sm">Email<input name="email" type="email" required autoComplete="username" className={ctl} /></label>
        <label className="block text-sm">Password<input name="password" type="password" required autoComplete="current-password" className={ctl} /></label>
        <button disabled={busy} className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
