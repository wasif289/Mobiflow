'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import VoucherSlip, { type Shop, type SlipData } from '@/components/VoucherSlip';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

type Size = 'thermal' | 'a4';

/**
 * Print page for one voucher.
 *   /vouchers/party/12/print?size=thermal&auto=1    supplier payment / customer receipt
 *   /vouchers/expense/7/print?size=a4               expense voucher
 * `auto=1` (used right after saving) prints straight away and closes the tab afterwards.
 */
export default function PrintVoucher() {
  const router = useRouter();
  const { kind, id } = useParams<{ kind: 'party' | 'expense'; id: string }>();
  const [data, setData] = useState<SlipData | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [size, setSize] = useState<Size>('thermal');
  const [auto, setAuto] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const printed = useRef(false);

  // ?size= and ?auto= come from the address bar (read after the page loads, so it stays a plain client page)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSize(q.get('size') === 'a4' ? 'a4' : 'thermal');
    setAuto(q.get('auto') === '1');
  }, []);

  useEffect(() => {
    api<SlipData>(kind === 'expense' ? `/expenses/${id}` : `/vouchers/${id}`).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load.'));
    api<Shop>('/shop').then(setShop).catch(() => setShop({ name: 'MobiFlow', phone: null, address: null, footer: null }));
  }, [kind, id]);

  // opened from the voucher window: print once everything has loaded, then close this tab
  useEffect(() => {
    if (!auto || !data || !shop || printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 450);
    const done = () => { if (window.opener) window.close(); };
    window.addEventListener('afterprint', done);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [auto, data, shop]);

  const thermal = size === 'thermal';
  return (
    <div className="space-y-3">
      {/* tells the printer which paper to use: an 80 mm roll or A4 */}
      <style>{`@media print { @page { size: ${thermal ? '80mm auto' : 'A4'}; margin: ${thermal ? '3mm' : '10mm'}; } }`}</style>

      <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft size={15} /> Back</button>
        {(['thermal', 'a4'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setSize(f)}
            className={cn('h-8 rounded-lg px-3 text-xs font-medium', size === f ? 'bg-primary text-white' : 'border border-border hover:bg-bg')}>{f === 'thermal' ? 'Thermal 80 mm' : 'A4 page'}</button>))}
        <button type="button" onClick={() => window.print()} className="ml-auto flex h-8 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-semibold text-white"><Printer size={14} /> Print</button>
      </div>

      {err && <div role="alert" className="no-print rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      {!data && !err && <p className="no-print text-sm text-muted">Loading…</p>}

      {/* #print-area is the only thing the printer sees (see globals.css) */}
      {data && shop && (
        <div id="print-area" className={cn('mx-auto rounded-xl bg-white p-3 text-black shadow-sm print:p-0 print:shadow-none', thermal ? 'w-fit border border-border' : 'w-full')}>
          <VoucherSlip data={data} shop={shop} size={size} />
        </div>)}
    </div>
  );
}