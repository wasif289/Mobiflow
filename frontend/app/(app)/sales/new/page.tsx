'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type Cust = { id: number; name: string };
type Line = { imei: string; label: string; price: string };
type Stock = { imei: string; model: string; color: string | null };

export default function NewSale() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState<string | null>(null); // null = full amount
  const [scan, setScan] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Cust[]>('/customers').then(setCustomers); }, []);
  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.price) || 0), 0), [lines]);
  const got = received === null ? total : Number(received) || 0;
  const due = total - got;
  const walkinShort = !customerId && due > 0;

  async function addScan(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const raw = scan.replace(/\D/g, '');
    if (lines.some((l) => l.imei === raw)) { setError(`${raw} is already in this sale.`); return; }
    try {
      const s = await api<Stock>(`/stock/${raw}`); // checks: valid, in stock, this branch, not sold
      setLines((l) => [...l, { imei: s.imei, label: `${s.model}${s.color ? ' · ' + s.color : ''}`, price: '' }]);
      setScan('');
    } catch (err) { setError(err instanceof ApiError ? err : 'Lookup failed.'); }
  }

  async function addCustomer() {
    const name = window.prompt('Customer name'); if (!name) return;
    try { const c = await api<Cust>('/customers', { method: 'POST', body: JSON.stringify({ name }) });
      setCustomers((x) => [...x, c]); setCustomerId(String(c.id)); }
    catch (err) { setError(err instanceof ApiError ? err : 'Could not add customer.'); }
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      await api('/sales', { method: 'POST', body: JSON.stringify({
        customer_id: customerId ? Number(customerId) : null, sale_date: date, received: String(got),
        items: lines.map((l) => ({ imei: l.imei, price: l.price })),
      }) });
      router.replace('/sales');
    } catch (err) { setError(err instanceof ApiError ? err : 'Could not save.'); } finally { setBusy(false); }
  }

  const ready = lines.length > 0 && lines.every((l) => Number(l.price) > 0) && !walkinShort && got <= total;
  const input = 'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
  const imeiErrors = error instanceof ApiError ? error.problem.errors?.imei : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New sale</h1>
      {error && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {typeof error === 'string' ? error : error.message}
          {imeiErrors && <ul className="mt-1 list-disc pl-5 text-xs">{imeiErrors.map((m) => <li key={m}>{m}</li>)}</ul>}
        </div>)}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <div className="flex gap-2 sm:col-span-2">
          <select aria-label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`${input} flex-1`}>
            <option value="">Walk-in customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={addCustomer} className="rounded-lg border border-border px-3 text-sm hover:bg-bg">+ New</button>
        </div>
        <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </div>
      <form onSubmit={addScan} className="flex gap-2">
        <input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} inputMode="numeric" placeholder="Scan or type IMEI, press Enter" className={`${input} flex-1`} />
        <button className="rounded-lg border border-border px-4 text-sm hover:bg-bg">Add</button>
      </form>
      <div className="rounded-xl border border-border bg-card">
        {lines.length === 0 ? <p className="p-4 text-sm text-muted">Scan a phone to start the sale.</p> : lines.map((l, i) => (
          <div key={l.imei} className="flex flex-wrap items-center gap-2 border-b border-border p-2 last:border-0">
            <span className="w-40 text-sm font-medium">{l.imei}</span>
            <span className="flex-1 text-sm text-muted">{l.label}</span>
            <input aria-label="Price" inputMode="decimal" value={l.price} placeholder="Price"
              onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className={`${input} w-32`} />
            <button aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="p-1.5 text-muted hover:text-danger"><X size={16} /></button>
          </div>))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">{lines.length} phones</span>
        <span className="text-lg font-bold">Total {total.toLocaleString('en-PK')}</span>
        <input inputMode="decimal" aria-label="Received" placeholder="Received" value={received ?? String(total)} onChange={(e) => setReceived(e.target.value)} className={`${input} w-32`} />
        {due > 0 && <span className={`text-sm ${walkinShort ? 'text-danger' : 'text-warning'}`}>{walkinShort ? 'Pick a customer to sell on credit' : `Due ${due.toLocaleString('en-PK')}`}</span>}
        <button disabled={!ready || busy} onClick={save} className="ml-auto rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Complete sale'}</button>
      </div>
    </div>
  );
}
