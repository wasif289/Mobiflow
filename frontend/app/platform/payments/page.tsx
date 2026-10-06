'use client';
import { useState } from 'react';
import DataTable, { type Col } from '@/components/DataTable';
import { api, ApiError, openFile } from '@/lib/api';
import { n } from '@/lib/format';

type P = { id: number; date: string; shop: string; invoice_no: string; plan: string; months: number; amount: string; method: string; provider: string; reference: string | null; status: string; review_note: string | null; has_proof: boolean };
const tone: Record<string, string> = { pending: 'bg-warning/15 text-warning', succeeded: 'bg-success/15 text-success', rejected: 'bg-danger/15 text-danger', failed: 'bg-danger/15 text-danger' };

export default function Payments() {
  const [reload, setReload] = useState(0); const [err, setErr] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) { setErr(null); try { await fn(); setReload((x) => x + 1); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Action failed.'); } }
  const btn = 'h-8 rounded-lg px-3 text-xs font-medium';
  const cols: Col<P>[] = [
    { key: 'date', label: 'Date', sort: 'date' }, { key: 'shop', label: 'Shop', sort: 'shop', cell: (r) => <b>{r.shop}</b> },
    { key: 'inv', label: 'Invoice', cell: (r) => <div>{r.invoice_no}<div className="text-xs text-muted">{r.plan} · {r.months === 12 ? 'yearly' : 'monthly'}</div></div> },
    { key: 'amount', label: 'Amount', sort: 'amount', align: 'right', cell: (r) => <b>{n(r.amount)}</b> },
    { key: 'via', label: 'Via', cell: (r) => <div className="capitalize">{r.provider}<div className="text-xs text-muted">{r.reference ?? ''}</div></div> },
    { key: 'status', label: 'Status', sort: 'status', cell: (r) => <div><span className={`rounded-full px-2 py-0.5 text-xs ${tone[r.status] ?? ''}`}>{r.status}</span>{r.review_note && <div className="text-xs text-muted">{r.review_note}</div>}</div> },
    { key: 'x', label: '', cell: (r) => (
      <div className="flex gap-1.5">
        {r.has_proof && <button className={`${btn} border border-border hover:bg-bg`} onClick={() => run(() => openFile(`/platform/payments/${r.id}/proof`))}>Receipt</button>}
        {r.status === 'pending' && r.method === 'manual' && <>
          <button className={`${btn} bg-success text-white`} onClick={() => confirm(`Approve ${n(r.amount)} from ${r.shop}? This activates their plan.`) && run(() => api(`/platform/payments/${r.id}/approve`, { method: 'POST' }))}>Approve</button>
          <button className={`${btn} bg-danger text-white`} onClick={() => { const reason = window.prompt('Reason for rejecting (the shop will see this)'); if (reason) run(() => api(`/platform/payments/${r.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })); }}>Reject</button></>}
      </div>) },
  ];
  return (
    <div className="space-y-3">
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      <DataTable<P> title="Payments" endpoint="/platform/payments" exportName="payments" rowKey={(r) => r.id} cols={cols} reload={reload} dates initial={{ status: 'pending' }} sort={{ key: 'date', dir: 'desc' }}
        searchHint="Search shop, invoice or reference…"
        filters={[{ name: 'status', label: 'Status', type: 'segment', options: [{ value: 'pending', label: 'Pending' }, { value: 'succeeded', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }] },
          { name: 'provider', label: 'All methods', options: [{ value: '', label: '' }, { value: 'stripe', label: 'Card (Stripe)' }, { value: 'bank', label: 'Bank' }, { value: 'jazzcash', label: 'JazzCash' }, { value: 'easypaisa', label: 'Easypaisa' }] }]}
        chips={(t) => [{ label: 'Payments', value: String(t.count) }, { label: 'Pending', value: String(t.pending), tone: 'text-warning' }, { label: 'Amount', value: n(t.amount), tone: 'text-success' }]} />
    </div>
  );
}
