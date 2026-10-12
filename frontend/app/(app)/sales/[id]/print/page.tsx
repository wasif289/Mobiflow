'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { n } from '@/lib/format';

type Sale = { invoice_no: string; sale_date: string; customer: string | null; total: string; received: string; due: string; items: { imei: string; model: string; price: string; returned: boolean }[] };
type Shop = { name: string; phone: string | null; address: string | null; footer: string | null };

export default function PrintSale() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null); const [shop, setShop] = useState<Shop | null>(null);
  const [fmt, setFmt] = useState<'thermal' | 'a4'>('thermal'); const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Sale>(`/sales/${id}`).then(setSale).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load.'));
    api<Shop>('/shop').then(setShop).catch(() => {});
  }, [id]);

  const thermal = fmt === 'thermal';
  return (
    <div className="space-y-3">
      {/* page size for the printer: roll paper or A4 */}
      <style>{`@media print { @page { size: ${thermal ? '80mm auto' : 'A4'}; margin: ${thermal ? '3mm' : '12mm'}; } }`}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link href={`/sales/${id}`} className="text-sm text-muted">← Back</Link>
        {(['thermal', 'a4'] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className={`h-8 rounded-lg px-3 text-xs font-medium ${fmt === f ? 'bg-primary text-white' : 'border border-border text-muted'}`}>{f === 'thermal' ? 'Receipt (80mm)' : 'A4 invoice'}</button>)}
        <button onClick={() => window.print()} className="ml-auto flex h-8 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-semibold text-white"><Printer size={14} /> Print</button>
      </div>
      {err && <div role="alert" className="no-print rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      {sale && (
        <article className={`mx-auto bg-white p-4 text-black ${thermal ? 'w-[76mm] text-[11px]' : 'max-w-3xl text-sm'}`}>
          <header className="text-center">
            <h1 className={thermal ? 'text-sm font-bold' : 'text-xl font-bold'}>{shop?.name ?? ''}</h1>
            {shop?.address && <div>{shop.address}</div>}{shop?.phone && <div>Tel: {shop.phone}</div>}
          </header>
          <hr className="my-2 border-dashed border-black" />
          <div className="flex justify-between"><span>Invoice: <b>{sale.invoice_no}</b></span><span>{sale.sale_date}</span></div>
          <div>Customer: {sale.customer ?? 'Walk-in'}</div>
          <hr className="my-2 border-dashed border-black" />
          <table className="w-full"><thead><tr className="text-left"><th>Item</th><th className="text-right">Price</th></tr></thead>
            <tbody>{sale.items.filter((i) => !i.returned).map((i) => (
              <tr key={i.imei} className="align-top"><td className="pr-2">{i.model}<div className="text-[0.9em] opacity-70">IMEI {i.imei}</div></td><td className="text-right tabular-nums">{n(i.price)}</td></tr>))}</tbody></table>
          <hr className="my-2 border-dashed border-black" />
          <div className="space-y-0.5 text-right tabular-nums">
            <div>Total <b>{n(sale.total)}</b></div><div>Received {n(sale.received)}</div>{Number(sale.due) > 0 && <div className="font-bold">Balance due {n(sale.due)}</div>}</div>
          {shop?.footer && <p className="mt-3 text-center">{shop.footer}</p>}
          <p className="mt-2 text-center text-[0.9em] opacity-70">Thank you!</p>
        </article>)}
    </div>
  );
}
