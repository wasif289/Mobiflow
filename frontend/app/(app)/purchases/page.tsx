'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type P = { id: number; invoice_no: string; purchase_date: string; supplier: string; total: string; paid: string; due: string };
const fmt = (v: string) => Number(v).toLocaleString('en-PK');

export default function Purchases() {
  const [rows, setRows] = useState<P[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ data: P[] }>('/purchases').then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-xl font-bold">Purchases</h1>
        <Link href="/purchases/new" className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> New purchase</Link>
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr>{['Invoice', 'Date', 'Supplier', 'Total', 'Paid', 'Due'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows === null && !error && <tr><td colSpan={6} className="px-4 py-4 text-muted">Loading…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-muted">No purchases in this branch yet.</td></tr>}
            {rows?.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium"><Link href={`/purchases/${p.id}`} className="text-primary hover:underline">{p.invoice_no}</Link></td><td className="px-4 py-2">{p.purchase_date}</td>
                <td className="px-4 py-2">{p.supplier}</td><td className="px-4 py-2">{fmt(p.total)}</td>
                <td className="px-4 py-2 text-success">{fmt(p.paid)}</td>
                <td className={`px-4 py-2 ${Number(p.due) > 0 ? 'text-danger' : ''}`}>{fmt(p.due)}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
