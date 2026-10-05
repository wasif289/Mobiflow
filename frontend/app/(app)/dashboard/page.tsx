'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

type D = { today_sales: string; in_stock: number; receivable: string; payable: string };
const rs = (v: string) => 'Rs ' + Number(v).toLocaleString('en-PK');

export default function Dashboard() {
  const { user, branchId } = useSession();
  const [d, setD] = useState<D | null>(null);
  const branch = user?.branches.find((b) => b.id === branchId);
  useEffect(() => { api<D>('/dashboard').then(setD).catch(() => setD(null)); }, [branchId]);

  const cards = [
    { label: 'Today’s sales', value: d ? rs(d.today_sales) : '…', tone: 'text-success' },
    { label: 'Phones in stock', value: d ? String(d.in_stock) : '…', tone: 'text-primary' },
    { label: 'Receivable (all branches)', value: d ? rs(d.receivable) : '…', tone: 'text-warning' },
    { label: 'Payable (all branches)', value: d ? rs(d.payable) : '…', tone: 'text-danger' },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">{branch ? branch.name : 'No branch assigned yet. Ask the owner to add you to one.'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</div>
          </div>))}
      </div>
    </div>
  );
}
