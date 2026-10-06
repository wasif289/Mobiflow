'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { n } from '@/lib/format';

type Plan = { id: number; code: string; name: string; max_users: number | null; max_branches: number | null; price: string; yearly_price: string | null; is_active: boolean; sort_order: number };
type Method = { key: string; label: string; details: string; enabled: boolean };
const blank = { code: '', name: '', max_users: '', max_branches: '', price: '', yearly_price: '', is_active: true, sort_order: '0' };
const ctl = 'h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]); const [methods, setMethods] = useState<Method[]>([]);
  const [f, setF] = useState<typeof blank>(blank); const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState<ApiError | string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => { api<Plan[]>('/platform/plans').then(setPlans); api<{ manual_methods: Method[] }>('/platform/settings').then((r) => setMethods(r.manual_methods)); }, []);
  useEffect(load, [load]);
  const fe = (k: string) => (err instanceof ApiError ? err.field(k) : undefined);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    const body = { ...(editing ? {} : { code: f.code }), name: f.name, price: f.price, yearly_price: f.yearly_price || null, max_users: f.max_users ? Number(f.max_users) : null,
      max_branches: f.max_branches ? Number(f.max_branches) : null, is_active: f.is_active, sort_order: Number(f.sort_order) };
    try { await api(editing ? `/platform/plans/${editing}` : '/platform/plans', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) }); setF(blank); setEditing(null); load(); setMsg('Plan saved.'); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Could not save.'); }
  }
  async function saveMethods() {
    setErr(null); setMsg(null);
    try { await api('/platform/settings', { method: 'PUT', body: JSON.stringify({ manual_methods: methods }) }); setMsg('Payment instructions saved.'); } catch (x) { setErr(x instanceof ApiError ? x : 'Could not save.'); }
  }
  const upd = (i: number, p: Partial<Method>) => setMethods((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-6">
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof err === 'string' ? err : err.message}</div>}
      {msg && <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{msg}</div>}
      <section className="space-y-3"><h1 className="text-xl font-bold">Plans</h1>
        <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-sm">
          <thead className="bg-bg/60 text-left text-xs uppercase text-muted"><tr>{['Plan', 'Branches', 'Users', 'Monthly', 'Yearly', 'Status', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>{plans.map((p) => (<tr key={p.id} className="border-t border-border"><td className="px-4 py-2.5"><b>{p.name}</b> <span className="text-xs text-muted">{p.code}</span></td><td className="px-4 py-2.5">{p.max_branches ?? '∞'}</td><td className="px-4 py-2.5">{p.max_users ?? '∞'}</td>
            <td className="px-4 py-2.5 tabular-nums">{n(p.price)}</td><td className="px-4 py-2.5 tabular-nums">{p.yearly_price ? n(p.yearly_price) : '—'}</td>
            <td className="px-4 py-2.5">{p.is_active ? 'Active' : 'Hidden'}</td>
            <td className="px-4 py-2.5 text-right"><button className="text-xs text-primary hover:underline" onClick={() => { setEditing(p.id); setF({ code: p.code, name: p.name, max_users: p.max_users?.toString() ?? '', max_branches: p.max_branches?.toString() ?? '', price: p.price, yearly_price: p.yearly_price ?? '', is_active: p.is_active, sort_order: String(p.sort_order) }); }}>Edit</button></td></tr>))}</tbody></table></div>
        <form onSubmit={save} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-4">
          <b className="text-sm sm:col-span-4">{editing ? 'Edit plan' : 'New plan'}</b>
          <label className="text-xs text-muted">Code<input className={ctl} value={f.code} disabled={!!editing} onChange={(e) => setF({ ...f, code: e.target.value })} required /><span className="text-danger">{fe('code')}</span></label>
          <label className="text-xs text-muted">Name<input className={ctl} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label className="text-xs text-muted">Monthly price<input className={ctl} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /><span className="text-danger">{fe('price')}</span></label>
          <label className="text-xs text-muted">Yearly price<input className={ctl} inputMode="decimal" value={f.yearly_price} onChange={(e) => setF({ ...f, yearly_price: e.target.value })} placeholder="12 × monthly" /></label>
          <label className="text-xs text-muted">Max branches<input className={ctl} type="number" min={1} value={f.max_branches} onChange={(e) => setF({ ...f, max_branches: e.target.value })} placeholder="unlimited" /></label>
          <label className="text-xs text-muted">Max users<input className={ctl} type="number" min={1} value={f.max_users} onChange={(e) => setF({ ...f, max_users: e.target.value })} placeholder="unlimited" /></label>
          <label className="text-xs text-muted">Sort order<input className={ctl} type="number" min={0} value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></label>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Visible to shops</label>
          <div className="flex gap-2 sm:col-span-4"><button className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white">{editing ? 'Save changes' : 'Add plan'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setF(blank); }} className="h-9 rounded-lg border border-border px-4 text-sm">Cancel</button>}</div>
        </form></section>
      <section className="space-y-3"><h2 className="text-xl font-bold">Manual payment instructions</h2>
        <p className="text-sm text-muted">Shown to shops when they pay by bank transfer or mobile wallet. Only enabled methods appear.</p>
        {methods.map((m, i) => (<div key={m.key} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[auto_1fr_2fr]">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.enabled} onChange={(e) => upd(i, { enabled: e.target.checked })} /> Enabled</label>
          <input className={ctl} value={m.label} onChange={(e) => upd(i, { label: e.target.value })} aria-label="Label" />
          <textarea className={`${ctl} h-20 py-2`} value={m.details} onChange={(e) => upd(i, { details: e.target.value })} placeholder={'Account title, number / IBAN, bank name…'} aria-label="Details" /></div>))}
        <button onClick={saveMethods} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white">Save instructions</button></section>
    </div>
  );
}
