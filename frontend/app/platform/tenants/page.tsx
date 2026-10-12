'use client';
import { useEffect, useState } from 'react';
import DataTable, { type Col } from '@/components/DataTable';
import { api, ApiError } from '@/lib/api';

type T = { id: number; name: string; slug: string; status: string; plan_id: number | null; plan: string | null; trial_ends_at: string | null; period_ends_at: string | null; created: string };
type Plan = { id: number; name: string };
const tone: Record<string, string> = { active: 'bg-success/15 text-success', trial: 'bg-primary/15 text-primary', past_due: 'bg-warning/15 text-warning', suspended: 'bg-danger/15 text-danger', cancelled: 'bg-muted/20 text-muted' };
const d = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-PK') : '—');

export default function Tenants() {
  const [plans, setPlans] = useState<Plan[]>([]); const [reload, setReload] = useState(0); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Plan[]>('/platform/plans').then(setPlans); }, []);
  async function act(path: string, body: object) {
    setErr(null);
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setReload((x) => x + 1); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Action failed.'); }
  }
  const sel = 'h-8 rounded-lg border border-border bg-bg px-2 text-xs';
  const cols: Col<T>[] = [
    { key: 'name', label: 'Shop', sort: 'name', cell: (r) => <div><b>{r.name}</b><div className="text-xs text-muted">{r.slug}</div></div> },
    { key: 'status', label: 'Status', sort: 'status', cell: (r) => <span className={`rounded-full px-2 py-0.5 text-xs ${tone[r.status] ?? ''}`}>{r.status.replace('_', ' ')}</span> },
    { key: 'plan', label: 'Plan', sort: 'plan', cell: (r) => <select aria-label="Plan" className={sel} value={r.plan_id ?? ''} onChange={(e) => act(`/platform/tenants/${r.id}/plan`, { plan_id: Number(e.target.value) })}>
      {!r.plan_id && <option value="">No plan</option>}{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> },
    { key: 'ends', label: 'Ends', sort: 'period', cell: (r) => d(r.status === 'trial' ? r.trial_ends_at : r.period_ends_at) },
    { key: 'created', label: 'Joined', sort: 'created' },
    { key: 'x', label: 'Actions', cell: (r) => (
      <div className="flex gap-1.5">
        <select aria-label="Set status" className={sel} value="" onChange={(e) => e.target.value && confirm(`Set ${r.name} to ${e.target.value}?`) && act(`/platform/tenants/${r.id}/status`, { status: e.target.value })}>
          <option value="">Set status…</option><option value="active">Active</option><option value="suspended">Suspend</option><option value="cancelled">Cancel</option></select>
        <button className={`${sel} hover:bg-bg`} onClick={() => { const v = window.prompt('Extend by how many days?', '30'); if (v && Number(v) > 0) act(`/platform/tenants/${r.id}/extend`, { days: Number(v) }); }}>+ Days</button></div>) },
  ];
  return (
    <div className="space-y-3">
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      <DataTable<T> title="Shops" endpoint="/platform/tenants" exportName="shops" rowKey={(r) => r.id} cols={cols} reload={reload} sort={{ key: 'created', dir: 'desc' }} searchHint="Search shop name or code…"
        filters={[{ name: 'status', label: 'Status', type: 'segment', options: [{ value: '', label: 'All' }, { value: 'trial', label: 'Trial' }, { value: 'active', label: 'Active' }, { value: 'past_due', label: 'Past due' }, { value: 'suspended', label: 'Suspended' }, { value: 'cancelled', label: 'Cancelled' }] },
          { name: 'plan_id', label: 'All plans', options: [{ value: '', label: '' }, ...plans.map((p) => ({ value: String(p.id), label: p.name }))] }]}
        chips={(t) => [{ label: 'Shops', value: String(t.count) }]} />
    </div>
  );
}
