'use client';
import { useEffect, useState } from 'react';
import DataTable, { type Col } from '@/components/DataTable';
import { api } from '@/lib/api';
import { n } from '@/lib/format';
import { useSession } from '@/lib/session';

type I = { id: number; imei: string; brand: string; model: string; color: string | null; status: string; entry_no: string; date: string; supplier: string;
  cost?: string; sale: string | null; profit?: string | null; sale_invoice: string | null; customer: string | null };
const tone: Record<string, string> = { in_stock: 'bg-success/15 text-success', sold: 'bg-muted/20 text-muted', in_transit: 'bg-warning/15 text-warning', returned_to_supplier: 'bg-danger/15 text-danger' };
type Opt = { value: string; label: string };

export default function Inventory() {
  const admin = ['owner', 'admin'].includes(useSession((s) => s.user?.role) ?? '');
  const [brands, setBrands] = useState<Opt[]>([]); const [sup, setSup] = useState<Opt[]>([]);
  useEffect(() => {
    api<{ data: { id: number; name: string }[] }>('/catalog/brands').then((r) => setBrands(r.data.map((b) => ({ value: String(b.id), label: b.name }))));
    api<{ id: number; name: string }[]>('/suppliers').then((r) => setSup(r.map((s) => ({ value: String(s.id), label: s.name }))));
  }, []);
  const cols = (f: Record<string, string>): Col<I>[] => {
    const sold = f.status === 'sold' || f.status === '';
    return [
      { key: 'imei', label: 'IMEI', cell: (r) => <span className="font-medium">{r.imei}</span> },
      { key: 'brand', label: 'Brand', sort: 'brand' }, { key: 'model', label: 'Model', sort: 'model' },
      { key: 'color', label: 'Color', cell: (r) => r.color ?? '—' },
      ...(admin ? [{ key: 'cost', label: 'Cost', sort: 'cost', align: 'right' as const, cell: (r: I) => n(r.cost) }] : []),
      { key: 'entry', label: 'Entry no', sort: 'entry', cell: (r) => r.entry_no }, { key: 'date', label: 'Date', sort: 'date' }, { key: 'supplier', label: 'Supplier', sort: 'supplier' },
      ...(sold ? [
        { key: 'sale', label: 'Sale price', sort: 'sale', align: 'right' as const, cell: (r: I) => n(r.sale) },
        ...(admin ? [{ key: 'profit', label: 'Profit', sort: 'profit', align: 'right' as const, cell: (r: I) => r.profit == null ? '—' : <span className={Number(r.profit) < 0 ? 'text-danger' : 'text-success'}>{n(r.profit)}</span> }] : []),
        { key: 'inv', label: 'Invoice', cell: (r: I) => r.sale_invoice ?? '—' }, { key: 'cust', label: 'Customer', cell: (r: I) => r.customer ?? '—' }] : []),
      { key: 'status', label: 'Status', cell: (r) => <span className={`rounded-full px-2 py-0.5 text-xs ${tone[r.status] ?? ''}`}>{r.status.replace(/_/g, ' ')}</span> },
    ];
  };
  return (
    <DataTable<I> title="Inventory" endpoint="/inventory" exportName="inventory" rowKey={(r) => r.id} cols={cols} dates sort={{ key: 'date', dir: 'desc' }}
      searchHint="Search IMEI, brand, model, supplier, invoice…" initial={{ status: 'in_stock' }}
      filters={[{ name: 'status', label: 'Status', type: 'segment', options: [{ value: 'in_stock', label: 'In stock' }, { value: 'sold', label: 'Sold' },
          { value: 'returned_to_supplier', label: 'Returned to supplier' }, { value: '', label: 'All' }] },
        { name: 'brand_id', label: 'All brands', options: [{ value: '', label: '' }, ...brands] },
        { name: 'supplier_id', label: 'All suppliers', options: [{ value: '', label: '' }, ...sup] }]}
      chips={(t) => [{ label: 'Phones', value: String(t.count), tone: 'text-primary' },
        ...(t.cost !== undefined ? [{ label: 'Cost value', value: n(t.cost) }] : []), { label: 'Sale value', value: n(t.sale), tone: 'text-success' },
        ...(t.profit !== undefined ? [{ label: 'Profit', value: n(t.profit), tone: 'text-success' }] : [])]} />
  );
}
