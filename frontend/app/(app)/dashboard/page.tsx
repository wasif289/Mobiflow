'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PeriodFilter, { type Period } from '@/components/PeriodFilter';
import { api } from '@/lib/api';
import { rangeFor } from '@/lib/dates';
import { n } from '@/lib/format';
import { useSession } from '@/lib/session';

type D = { sales: string; qty_sold: number; purchases: string; expenses: string; in_stock: number; receivable: string; payable: string;
  profit?: string; net_profit?: string; recent: { id: number; invoice_no: string; date: string; customer: string; total: string }[] };

export default function Dashboard() {
  const { user, branchId } = useSession();
  const [period, setPeriod] = useState<Period>({ preset: 'today', ...rangeFor('today') });
  const [d, setD] = useState<D | null>(null); const [error, setError] = useState(false);
  const branch = user?.branches.find((b) => b.id === branchId);
  useEffect(() => {
    setError(false);
    const u = new URLSearchParams(); if (period.from) u.set('from', period.from); if (period.to) u.set('to', period.to);
    api<D>(`/dashboard?${u}`).then(setD).catch(() => setError(true));
  }, [period, branchId]);
  const rs = (v?: string) => (d && v !== undefined ? 'Rs ' + n(v) : '…');
  const cards = [
    { label: 'Sales', value: rs(d?.sales), tone: 'text-success' }, { label: 'Phones sold', value: d ? String(d.qty_sold) : '…', tone: 'text-primary' },
    ...(d?.profit !== undefined ? [{ label: 'Profit', value: rs(d.profit), tone: 'text-success' }] : []),
    { label: 'Purchases', value: rs(d?.purchases), tone: 'text-text' }, { label: 'Expenses', value: rs(d?.expenses), tone: 'text-danger' },
    ...(d?.net_profit !== undefined ? [{ label: 'Net profit', value: rs(d.net_profit), tone: Number(d.net_profit) < 0 ? 'text-danger' : 'text-success' }] : []),
    { label: 'Phones in stock', value: d ? String(d.in_stock) : '…', tone: 'text-primary' },
    { label: 'Receivable', value: rs(d?.receivable), tone: 'text-warning' }, { label: 'Payable', value: rs(d?.payable), tone: 'text-danger' },
  ];
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold">Dashboard</h1><p className="text-sm text-muted">{branch ? branch.name : 'No branch assigned yet. Ask the owner to add you to one.'}</p></div>
      <div className="rounded-xl border border-border bg-card p-3"><PeriodFilter value={period} onChange={setPeriod} /></div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Could not load the dashboard. Try again.</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted">{c.label}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</div></div>))}</div>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center border-b border-border px-4 py-2.5"><b className="text-sm">Recent sales</b><Link href="/sales" className="ml-auto text-xs text-primary">View all</Link></div>
        {d?.recent.length === 0 && <p className="p-4 text-sm text-muted">No sales yet.</p>}
        {d?.recent.map((s) => (
          <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-bg">
            <span className="font-medium text-primary">{s.invoice_no}</span><span className="text-muted">{s.date}</span><span className="flex-1">{s.customer}</span><b className="tabular-nums">{n(s.total)}</b></Link>))}
      </div>
    </div>
  );
}
