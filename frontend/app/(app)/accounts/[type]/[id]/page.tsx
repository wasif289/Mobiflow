'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

type Stmt = { party: { id: number; name: string }; balance: string;
  rows: { id: number; date: string; description: string; debit: string; credit: string; balance: string }[] };
const fmt = (v: string) => (Number(v) === 0 ? '' : Number(v).toLocaleString('en-PK'));

export default function Statement() {
  const { type, id } = useParams<{ type: 'supplier' | 'customer'; id: string }>();
  const [s, setS] = useState<Stmt | null>(null);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [direction, setDirection] = useState(type === 'supplier' ? 'payment' : 'receipt');
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Stmt>(`/accounts/${type}/${id}`).then(setS).catch((e) => setError(e instanceof ApiError ? e : 'Failed to load.'));
  }, [type, id]);
  useEffect(load, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api('/vouchers', { method: 'POST', body: JSON.stringify({
        party_type: type, party_id: Number(id), direction, method, amount, notes: notes || null,
        voucher_date: new Date().toISOString().slice(0, 10) }) });
      setAmount(''); setNotes(''); load();
    } catch (err) { setError(err instanceof ApiError ? err : 'Could not save.'); } finally { setBusy(false); }
  }

  const input = 'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
  const owes = type === 'customer' ? 'owes you' : 'you owe';
  return (
    <div className="space-y-4">
      <Link href="/accounts" className="text-sm text-muted">← Accounts</Link>
      <div className="flex items-end gap-3">
        <h1 className="text-xl font-bold">{s?.party.name ?? '…'}</h1>
        {s && <span className="text-sm text-muted">{Number(s.balance) === 0 ? 'Settled' : `${owes} ${Number(s.balance).toLocaleString('en-PK')}`}</span>}
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        {typeof error === 'string' ? error : error.message}{error instanceof ApiError && error.field('amount') ? `: ${error.field('amount')}` : ''}</div>}
      <form onSubmit={save} className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction" className={input}>
          <option value="receipt">Money received</option><option value="payment">Money paid</option></select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method" className={input}>
          {['cash', 'bank', 'jazzcash', 'easypaisa', 'cheque'].map((m) => <option key={m}>{m}</option>)}</select>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required className={`${input} w-32`} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className={`${input} min-w-40 flex-1`} />
        <button disabled={busy} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Record'}</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr>{['Date', 'Description', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {s?.rows.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-muted">No entries yet.</td></tr>}
            {s?.rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{r.date}</td><td className="px-4 py-2">{r.description}</td>
                <td className="px-4 py-2">{fmt(r.debit)}</td><td className="px-4 py-2 text-success">{fmt(r.credit)}</td>
                <td className="px-4 py-2 font-medium">{Number(r.balance).toLocaleString('en-PK')}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
