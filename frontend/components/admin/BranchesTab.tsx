'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Br = { id: number; code: string; name: string; phone: string | null; address: string | null; is_main: boolean; is_active: boolean };

export default function BranchesTab() {
  const [rows, setRows] = useState<Br[] | null>(null);
  const [f, setF] = useState({ code: '', name: '', phone: '', address: '' });
  const [err, setErr] = useState<ApiError | string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<Br[]>('/admin/branches').then(setRows).catch((e) => setErr(e instanceof ApiError ? e : 'Failed to load.')); }, []);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/admin/branches', { method: 'POST', body: JSON.stringify(f) }); setF({ code: '', name: '', phone: '', address: '' }); load(); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Could not add.'); } finally { setBusy(false); }
  }
  async function patch(b: Br, body: Partial<Br>) {
    setErr(null);
    try { await api(`/admin/branches/${b.id}`, { method: 'PUT', body: JSON.stringify(body) }); load(); } catch (x) { setErr(x instanceof ApiError ? x : 'Could not save.'); }
  }
  const fe = (k: string) => (err instanceof ApiError ? err.field(k) : undefined);
  const ctl = 'h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Branches</h1>
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof err === 'string' ? err : err.message}</div>}
      <form onSubmit={add} className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-card p-3">
        <div><input placeholder="Code (e.g. DHA)" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required className={`${ctl} w-36 uppercase`} />{fe('code') && <div className="text-xs text-danger">{fe('code')}</div>}</div>
        <input placeholder="Branch name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required className={`${ctl} min-w-44 flex-1`} />
        <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={`${ctl} w-40`} />
        <input placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={`${ctl} min-w-44 flex-1`} />
        <button disabled={busy} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Adding…' : 'Add branch'}</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-sm">
        <thead className="bg-bg/60 text-left text-xs uppercase text-muted"><tr>{['Code', 'Name', 'Phone', 'Address', 'Status', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody>{!rows && <tr><td colSpan={6} className="px-4 py-6 text-muted">Loading…</td></tr>}
          {rows?.map((b) => (<tr key={b.id} className="border-t border-border hover:bg-bg/50">
            <td className="px-4 py-2.5 font-medium">{b.code}{b.is_main && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Main</span>}</td>
            <td className="px-4 py-2.5">{b.name}</td><td className="px-4 py-2.5">{b.phone ?? '—'}</td><td className="px-4 py-2.5">{b.address ?? '—'}</td>
            <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs ${b.is_active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{b.is_active ? 'Active' : 'Inactive'}</span></td>
            <td className="space-x-3 whitespace-nowrap px-4 py-2.5 text-right text-xs">
              <button onClick={() => { const name = window.prompt('Branch name', b.name); if (name && name !== b.name) patch(b, { name }); }} className="text-primary hover:underline">Rename</button>
              {!b.is_main && <button onClick={() => patch(b, { is_active: !b.is_active })} className={b.is_active ? 'text-danger hover:underline' : 'text-success hover:underline'}>{b.is_active ? 'Deactivate' : 'Activate'}</button>}</td></tr>))}</tbody></table></div>
    </div>
  );
}
