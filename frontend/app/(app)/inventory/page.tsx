'use client';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Row = { imei: string; status: string; model: string; color: string | null; cost?: string };
const TABS = [['in_stock', 'In stock'], ['sold', 'Sold'], ['', 'All']] as const;
const tone: Record<string, string> = { in_stock: 'text-success', sold: 'text-muted', in_transit: 'text-warning' };

export default function Inventory() {
  const [status, setStatus] = useState<string>('in_stock');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null); setError(null);
    const t = setTimeout(() => {
      api<{ data: Row[] }>(`/inventory?status=${status}&q=${encodeURIComponent(q)}`).then((r) => setRows(r.data))
        .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'));
    }, 250); // debounce typing
    return () => clearTimeout(t);
  }, [status, q]);
  const showCost = rows?.some((r) => r.cost !== undefined);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Inventory</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1">
          {TABS.map(([v, l]) => (
            <button key={l} role="tab" aria-selected={status === v} onClick={() => setStatus(v)}
              className={`rounded-lg px-4 py-2 text-sm ${status === v ? 'bg-primary text-white' : 'border border-border text-muted'}`}>{l}</button>))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" placeholder="Search IMEI"
          className="ml-auto min-w-48 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr>{['IMEI', 'Model', 'Color', ...(showCost ? ['Cost'] : []), 'Status'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows === null && !error && <tr><td colSpan={5} className="px-4 py-4 text-muted">Loading…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-muted">No phones found.</td></tr>}
            {rows?.map((r) => (
              <tr key={r.imei + r.status} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{r.imei}</td><td className="px-4 py-2">{r.model}</td><td className="px-4 py-2">{r.color ?? '—'}</td>
                {showCost && <td className="px-4 py-2">{Number(r.cost).toLocaleString('en-PK')}</td>}
                <td className={`px-4 py-2 ${tone[r.status] ?? ''}`}>{r.status.replace('_', ' ')}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
