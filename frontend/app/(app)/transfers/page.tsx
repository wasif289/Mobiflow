'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import DataTable, { type Col } from '@/components/DataTable';
import { api, ApiError } from '@/lib/api';
import { useCan } from '@/lib/can';
import { useSession } from '@/lib/session';

type T = { id: number; transfer_no: string; date: string; from_id: number; to_id: number; from: string; to: string; qty: number; status: string; note: string | null };
const tone: Record<string, string> = { pending: 'bg-warning/15 text-warning', received: 'bg-success/15 text-success', cancelled: 'bg-muted/20 text-muted' };

export default function Transfers() {
  const branchId = useSession((s) => s.branchId);
  const canAct = useCan()('transfers.create');
  const [reload, setReload] = useState(0); const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<{ no: string; items: { imei: string; model: string }[] } | null>(null);

  async function run(fn: () => Promise<unknown>) { setErr(null); try { await fn(); setReload((x) => x + 1); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Action failed.'); } }
  async function open(t: T) {
    try { const r = await api<{ items: { imei: string; model: string }[] }>(`/transfers/${t.id}`); setView({ no: t.transfer_no, items: r.items }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not load.'); }
  }
  const btn = 'h-8 rounded-lg px-3 text-xs font-medium';
  const cols: Col<T>[] = [
    { key: 'no', label: 'Transfer', sort: 'no', cell: (r) => <button onClick={() => open(r)} className="font-medium text-primary hover:underline">{r.transfer_no}</button> },
    { key: 'date', label: 'Date', sort: 'date' },
    { key: 'route', label: 'From → To', cell: (r) => <span>{r.from} <span className="text-muted">→</span> {r.to}</span> },
    { key: 'qty', label: 'Phones', sort: 'qty', align: 'center' },
    { key: 'status', label: 'Status', sort: 'status', cell: (r) => <span className={`rounded-full px-2 py-0.5 text-xs ${tone[r.status] ?? ''}`}>{r.status}</span> },
    { key: 'note', label: 'Note', cell: (r) => r.note ?? '—' },
    { key: 'x', label: '', cell: (r) => r.status !== 'pending' || !canAct ? null : (
      <div className="flex gap-1.5">
        {r.to_id === branchId && <button className={`${btn} bg-success text-white`} onClick={() => confirm(`Receive ${r.qty} phone(s) into this branch?`) && run(() => api(`/transfers/${r.id}/receive`, { method: 'POST' }))}>Receive</button>}
        {r.from_id === branchId && <button className={`${btn} border border-border text-danger hover:bg-danger/10`} onClick={() => confirm('Cancel this transfer? The phones return to stock here.') && run(() => api(`/transfers/${r.id}/cancel`, { method: 'POST' }))}>Cancel</button>}
      </div>) },
  ];
  return (
    <div className="space-y-3">
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      <DataTable<T> title="Stock transfers" endpoint="/transfers" exportName="transfers" rowKey={(r) => r.id} cols={cols} reload={reload} dates sort={{ key: 'date', dir: 'desc' }}
        searchHint="Search transfer no or IMEI…" initial={{ direction: '' }}
        filters={[{ name: 'direction', label: 'Direction', type: 'segment', options: [{ value: '', label: 'All' }, { value: 'in', label: 'Incoming' }, { value: 'out', label: 'Outgoing' }] },
          { name: 'status', label: 'Any status', options: [{ value: '', label: '' }, { value: 'pending', label: 'Pending' }, { value: 'received', label: 'Received' }, { value: 'cancelled', label: 'Cancelled' }] }]}
        chips={(t) => [{ label: 'Transfers', value: String(t.count) }, { label: 'Phones', value: String(t.qty), tone: 'text-primary' }, { label: 'Waiting to be received', value: String(t.pending), tone: 'text-warning' }]}
        actions={canAct ? <Link href="/transfers/new" className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><Plus size={16} /> New transfer</Link> : null} />
      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center"><h2 className="font-bold">{view.no}</h2><button onClick={() => setView(null)} aria-label="Close" className="ml-auto p-1 text-muted"><X size={18} /></button></div>
            {view.items.map((i) => <div key={i.imei} className="flex gap-3 border-b border-border py-2 text-sm last:border-0"><b className="w-36">{i.imei}</b><span className="text-muted">{i.model}</span></div>)}
          </div>
        </div>)}
    </div>
  );
}
