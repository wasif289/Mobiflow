'use client';
import { useState } from 'react';
import Link from 'next/link';
import DataTable, { type Col } from '@/components/DataTable';
import { n } from '@/lib/format';

type R = { id: number; name: string; phone: string | null; balance: string };

export default function Accounts() {
  const [type, setType] = useState<'customer' | 'supplier'>('customer');
  const cust = type === 'customer';
  const tone = cust ? 'text-warning' : 'text-danger';
  const cols: Col<R>[] = [
    { key: 'id', label: '#', cell: (r) => r.id },
    { key: 'name', label: cust ? 'Customer' : 'Supplier', sort: 'name', cell: (r) => <Link href={`/accounts/${type}/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link> },
    { key: 'phone', label: 'Phone', sort: 'phone', cell: (r) => r.phone ?? '—' },
    { key: 'balance', label: cust ? 'Receivable' : 'Payable', sort: 'balance', align: 'right', cell: (r) => <b className={Number(r.balance) > 0 ? tone : Number(r.balance) < 0 ? 'text-success' : 'text-muted'}>{n(r.balance)}</b> },
    { key: 'st', label: 'Status', cell: (r) => Number(r.balance) > 0 ? (cust ? 'Receivable' : 'Payable') : Number(r.balance) < 0 ? 'Advance' : 'Settled' },
  ];
  return (
    <div className="space-y-4">
      <div className="no-print flex gap-2">{(['customer', 'supplier'] as const).map((t) => (
        <button key={t} onClick={() => setType(t)} className={`rounded-lg px-4 py-2 text-sm font-medium ${type === t ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-bg'}`}>{t === 'customer' ? 'Customers' : 'Suppliers'}</button>))}</div>
      <DataTable<R> key={type} title={cust ? 'Customer accounts' : 'Supplier accounts'} endpoint={`/accounts/${type}`} exportName={`${type}-balances`} rowKey={(r) => r.id}
        cols={cols} sort={{ key: 'name', dir: 'asc' }} searchHint={`Search ${type}, phone…`}
        filters={[{ name: 'balance', label: 'All balances', options: [{ value: '', label: '' }, { value: 'positive', label: cust ? 'Receivable only' : 'Payable only' },
            { value: 'advance', label: 'Advance only' }, { value: 'zero', label: 'Settled (zero)' }] }, { name: 'min_balance', label: 'Min balance', type: 'number' }]}
        chips={(t) => [{ label: cust ? 'Customers' : 'Suppliers', value: String(t.count) }, { label: cust ? 'Total receivable' : 'Total payable', value: n(t.total), tone }]} />
    </div>
  );
}
