'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import DataTable, { type Col } from '@/components/DataTable';
import { api } from '@/lib/api';
import { n } from '@/lib/format';

type P = { id: number; invoice_no: string; date: string; supplier: string; qty: number; total: string; paid: string; due: string };
const cols: Col<P>[] = [
  { key: 'invoice', label: 'Entry no', sort: 'invoice', cell: (r) => <Link href={`/purchases/${r.id}`} className="font-medium text-primary hover:underline">{r.invoice_no}</Link> },
  { key: 'date', label: 'Date', sort: 'date' },
  { key: 'supplier', label: 'Supplier', sort: 'supplier' },
  { key: 'qty', label: 'Qty', sort: 'qty', align: 'center' },
  { key: 'total', label: 'Total', sort: 'total', align: 'right', cell: (r) => n(r.total) },
  { key: 'paid', label: 'Paid', sort: 'paid', align: 'right', cell: (r) => <span className="text-success">{n(r.paid)}</span> },
  { key: 'due', label: 'Due', sort: 'due', align: 'right', cell: (r) => <span className={Number(r.due) > 0 ? 'text-danger' : 'text-muted'}>{n(r.due)}</span> },
];

export default function Purchases() {
  const [sup, setSup] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => { api<{ id: number; name: string }[]>('/suppliers').then((r) => setSup(r.map((s) => ({ value: String(s.id), label: s.name })))); }, []);
  return (
    <DataTable<P> title="Purchases" endpoint="/purchases" exportName="purchases" rowKey={(r) => r.id} cols={cols} dates defaultPeriod="month"
      searchHint="Search entry no, supplier or IMEI…" sort={{ key: 'date', dir: 'desc' }}
      filters={[{ name: 'supplier_id', label: 'All suppliers', options: [{ value: '', label: '' }, ...sup] },
        { name: 'status', label: 'Any payment', options: [{ value: '', label: '' }, { value: 'due', label: 'Has due' }, { value: 'paid', label: 'Fully paid' }] }]}
      chips={(t) => [{ label: 'Purchases', value: String(t.count) }, { label: 'Phones', value: n(t.qty), tone: 'text-primary' }, { label: 'Total', value: n(t.total) },
        { label: 'Paid', value: n(t.paid), tone: 'text-success' }, { label: 'Due', value: n(t.due), tone: 'text-danger' }]}
      actions={<Link href="/purchases/new" className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><Plus size={16} /> New purchase</Link>} />
  );
}
