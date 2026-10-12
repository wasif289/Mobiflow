'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import DataTable, { type Col } from '@/components/DataTable';
import { api } from '@/lib/api';
import { n } from '@/lib/format';
import { useSession } from '@/lib/session';

type S = { id: number; invoice_no: string; date: string; customer: string; qty: number; total: string; received: string; due: string; profit?: string };

export default function Sales() {
  const admin = ['owner', 'admin'].includes(useSession((s) => s.user?.role) ?? '');
  const [cust, setCust] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => { api<{ id: number; name: string }[]>('/customers').then((r) => setCust(r.map((c) => ({ value: String(c.id), label: c.name })))); }, []);
  const cols: Col<S>[] = [
    { key: 'invoice', label: 'Invoice', sort: 'invoice', cell: (r) => <Link href={`/sales/${r.id}`} className="font-medium text-primary hover:underline">{r.invoice_no}</Link> },
    { key: 'date', label: 'Date', sort: 'date' },
    { key: 'customer', label: 'Customer', sort: 'customer' },
    { key: 'qty', label: 'Qty', sort: 'qty', align: 'center' },
    { key: 'total', label: 'Amount', sort: 'total', align: 'right', cell: (r) => n(r.total) },
    { key: 'received', label: 'Received', sort: 'received', align: 'right', cell: (r) => <span className="text-success">{n(r.received)}</span> },
    { key: 'due', label: 'Due', sort: 'due', align: 'right', cell: (r) => <span className={Number(r.due) > 0 ? 'text-danger' : 'text-muted'}>{n(r.due)}</span> },
    ...(admin ? [{ key: 'profit', label: 'Profit', sort: 'profit', align: 'right' as const, cell: (r: S) => <span className={Number(r.profit) < 0 ? 'text-danger' : 'text-success'}>{n(r.profit)}</span> }] : []),
  ];
  return (
    <DataTable<S> title="Sales" endpoint="/sales" exportName="sales" rowKey={(r) => r.id} cols={cols} dates defaultPeriod="month"
      searchHint="Search invoice, customer or IMEI…" sort={{ key: 'date', dir: 'desc' }}
      filters={[{ name: 'customer_id', label: 'All customers', options: [{ value: '', label: '' }, { value: 'walkin', label: 'Walk-in' }, ...cust] },
        { name: 'status', label: 'Any payment', options: [{ value: '', label: '' }, { value: 'due', label: 'Has due' }, { value: 'paid', label: 'Fully paid' }] }]}
      chips={(t) => [{ label: 'Invoices', value: String(t.count) }, { label: 'Phones', value: n(t.qty), tone: 'text-primary' }, { label: 'Amount', value: n(t.total) },
        { label: 'Received', value: n(t.received), tone: 'text-success' }, { label: 'Due', value: n(t.due), tone: 'text-danger' },
        ...(t.profit !== undefined ? [{ label: 'Profit', value: n(t.profit), tone: 'text-success' }] : [])]}
      actions={<Link href="/sales/new" className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><Plus size={16} /> New sale</Link>} />
  );
}
