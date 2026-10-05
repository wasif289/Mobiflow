'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

type Row = { id: number; name: string; phone: string | null; balance: string };
const TABS = [['customer', 'Customers', 'They owe you'], ['supplier', 'Suppliers', 'You owe them']] as const;
const fmt = (v: string) => Number(v).toLocaleString('en-PK');

export default function Accounts() {
  const [type, setType] = useState<'customer' | 'supplier'>('customer');
  const [data, setData] = useState<{ total: string; rows: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null); setError(null);
    api<{ total: string; rows: Row[] }>(`/accounts/${type}`).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'));
  }, [type]);
  const tone = type === 'customer' ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Accounts</h1>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setType(v)} className={`rounded-lg px-4 py-2 text-sm ${type === v ? 'bg-primary text-white' : 'border border-border text-muted'}`}>{l}</button>))}
        {data && <span className="ml-auto text-sm text-muted">{TABS.find((t) => t[0] === type)![2]}: <b className={tone}>{fmt(data.total)}</b></span>}
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className="rounded-xl border border-border bg-card">
        {!data && !error && <p className="p-4 text-sm text-muted">Loading…</p>}
        {data?.rows.length === 0 && <p className="p-4 text-sm text-muted">No {type}s yet. They are added from the {type === 'customer' ? 'Sales' : 'Purchase'} screen.</p>}
        {data?.rows.map((r) => (
          <Link key={r.id} href={`/accounts/${type}/${r.id}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-bg">
            <span className="flex-1 text-sm">{r.name}{r.phone && <span className="ml-2 text-xs text-muted">{r.phone}</span>}</span>
            <span className={`text-sm font-semibold ${Number(r.balance) !== 0 ? tone : 'text-muted'}`}>{fmt(r.balance)}</span>
          </Link>))}
      </div>
    </div>
  );
}
