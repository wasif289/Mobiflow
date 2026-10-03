'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession, type User } from '@/lib/session';

const FIELDS = [
  { name: 'shop_name', label: 'Shop name', type: 'text' },
  { name: 'slug', label: 'Shop code (used to sign in)', type: 'text' },
  { name: 'name', label: 'Your name', type: 'text' },
  { name: 'username', label: 'Username', type: 'text' },
  { name: 'password', label: 'Password (8+ characters)', type: 'password' },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setError(null);
    try {
      const r = await api<{ token: string; user: User; tenant: string }>('/auth/register', {
        method: 'POST', tenant: 'none', body: JSON.stringify(body),
      });
      signIn(r.token, r.tenant, r.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Start your 14-day trial</h1>
        {error && !error.problem.errors && (
          <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error.message}</div>
        )}
        {FIELDS.map((f) => (
          <label key={f.name} className="block text-sm">{f.label}
            <input name={f.name} type={f.type} required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary" />
            {error?.field(f.name) && <span className="text-xs text-danger">{error.field(f.name)}</span>}
          </label>
        ))}
        <button disabled={busy} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Creating your shop…' : 'Create shop'}
        </button>
        <p className="text-center text-sm text-muted">Already registered? <Link href="/login" className="text-primary">Sign in</Link></p>
      </form>
    </main>
  );
}
