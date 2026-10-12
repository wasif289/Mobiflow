'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { n } from '@/lib/format';

type O = { shops: Record<string, number>; pending_payments: number; revenue_this_month: string; mrr_estimate: string };

export default function Overview() {
  const [o, setO] = useState<O | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<O>('/platform/overview').then(setO).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load.')); }, []);
  const cards = o ? [['Shops', o.shops.total, ''], ['On trial', o.shops.trial, 'text-primary'], ['Paying', o.shops.active, 'text-success'], ['Past due', o.shops.past_due, 'text-warning'],
    ['Suspended', o.shops.suspended, 'text-danger'], ['Revenue this month', 'Rs ' + n(o.revenue_this_month), 'text-success'], ['Monthly recurring (est.)', 'Rs ' + n(o.mrr_estimate), '']] : [];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Overview</h1>
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      {o && o.pending_payments > 0 && <Link href="/platform/payments" className="block rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm font-semibold text-warning">{o.pending_payments} payment{o.pending_payments === 1 ? '' : 's'} waiting for your review →</Link>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([l, v, t]) => (
        <div key={String(l)} className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted">{l}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${t}`}>{v}</div></div>))}</div>
    </div>
  );
}
