'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type S = { id: number; invoice_no: string; sale_date: string; customer: string | null; total: string; received: string; due: string; profit?: string };
const fmt = (v: string) => Number(v).toLocaleString('en-PK');

export default function Sales() {
  const [rows, setRows] = useState<S[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ data: S[] }>('/sales').then((r) => setRows(r.data)).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'));
  }, []);
  const showProfit = rows?.some((r) => r.profit !== undefined);
  const heads = ['Invoice', 'Date', 'Customer', 'Total', 'Received', 'Due', ...(showProfit ? ['Profit'] : [])];

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-xl font-bold">Sales</h1>
        <Link href="/sales/new" className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> New sale</Link>
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr>{heads.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows === null && !error && <tr><td colSpan={heads.length} className="px-4 py-4 text-muted">Loading…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={heads.length} className="px-4 py-4 text-muted">No sales in this branch yet.</td></tr>}
            {rows?.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium"><Link href={`/sales/${s.id}`} className="text-primary hover:underline">{s.invoice_no}</Link></td><td className="px-4 py-2">{s.sale_date}</td>
                <td className="px-4 py-2">{s.customer ?? <span className="text-muted">Walk-in</span>}</td>
                <td className="px-4 py-2">{fmt(s.total)}</td><td className="px-4 py-2 text-success">{fmt(s.received)}</td>
                <td className={`px-4 py-2 ${Number(s.due) > 0 ? 'text-danger' : ''}`}>{fmt(s.due)}</td>
                {showProfit && <td className={`px-4 py-2 ${Number(s.profit) < 0 ? 'text-danger' : 'text-success'}`}>{fmt(s.profit ?? '0')}</td>}
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
