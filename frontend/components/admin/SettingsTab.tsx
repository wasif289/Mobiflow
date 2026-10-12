'use client';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type S = { name: string; phone: string | null; address: string | null; footer: string | null;
  plan: { name: string; status: string; trial_ends_at: string | null; max_users: number | null; max_branches: number | null; users: number; branches: number } };

export default function SettingsTab() {
  const [s, setS] = useState<S | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<ApiError | string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api<S>('/admin/settings').then(setS).catch((e) => setErr(e instanceof ApiError ? e : 'Failed to load.')); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return; setBusy(true); setErr(null); setMsg(null);
    try { setS(await api<S>('/admin/settings', { method: 'PUT', body: JSON.stringify({ name: s.name, phone: s.phone, address: s.address, footer: s.footer }) })); setMsg('Settings saved.'); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Could not save.'); } finally { setBusy(false); }
  }
  const ctl = 'h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  const use = (n: number, max: number | null) => `${n} / ${max ?? 'unlimited'}`;
  const days = s?.plan.trial_ends_at ? Math.ceil((new Date(s.plan.trial_ends_at).getTime() - Date.now()) / 86400000) : null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Shop settings</h1>
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof err === 'string' ? err : err.message}</div>}
      {msg && <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{msg}</div>}
      {s && (<>
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Plan', s.plan.name], ['Status', s.plan.status + (s.plan.status === 'trial' && days !== null ? ` · ${Math.max(days, 0)} days left` : '')],
            ['Users', use(s.plan.users, s.plan.max_users)], ['Branches', use(s.plan.branches, s.plan.max_branches)]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted">{l}</div><div className="mt-1 text-lg font-bold capitalize">{v}</div></div>))}
        </div>
        <form onSubmit={save} className="grid max-w-2xl gap-3 rounded-xl border border-border bg-card p-4">
          <label className="text-sm">Shop name<input className={ctl} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} required /></label>
          <label className="text-sm">Phone<input className={ctl} value={s.phone ?? ''} onChange={(e) => setS({ ...s, phone: e.target.value })} /></label>
          <label className="text-sm">Address<input className={ctl} value={s.address ?? ''} onChange={(e) => setS({ ...s, address: e.target.value })} /></label>
          <label className="text-sm">Receipt footer<input className={ctl} value={s.footer ?? ''} onChange={(e) => setS({ ...s, footer: e.target.value })} placeholder="e.g. No return after 7 days" /></label>
          <div><button disabled={busy} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form></>)}
    </div>
  );
}
