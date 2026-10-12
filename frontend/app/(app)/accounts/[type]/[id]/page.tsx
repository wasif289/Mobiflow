'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Download, Printer, Search } from 'lucide-react';
import PeriodFilter, { type Period } from '@/components/PeriodFilter';
import { api, ApiError } from '@/lib/api';
import { rangeFor } from '@/lib/dates';
import { n } from '@/lib/format';

type Row = { id: number; date: string; ref: string; description: string; debit: string; credit: string; balance: string };
type Stmt = { party: { id: number; name: string }; balance: string; rows: Row[] };
const cell = (v: string) => (Number(v) === 0 ? '' : n(v));

export default function Statement() {
  const { type, id } = useParams<{ type: 'supplier' | 'customer'; id: string }>();
  const [s, setS] = useState<Stmt | null>(null); const [error, setError] = useState<ApiError | string | null>(null);
  const [period, setPeriod] = useState<Period>({ preset: 'all', ...rangeFor('all') }); const [q, setQ] = useState('');
  const [direction, setDirection] = useState(type === 'supplier' ? 'payment' : 'receipt'); const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const u = new URLSearchParams(); if (period.from) u.set('from', period.from); if (period.to) u.set('to', period.to);
    api<Stmt>(`/accounts/${type}/${id}?${u}`).then(setS).catch((e) => setError(e instanceof ApiError ? e : 'Failed to load.'));
  }, [type, id, period]);
  useEffect(load, [load]);

  const rows = useMemo(() => (s?.rows ?? []).filter((r) => !q || (r.description + r.ref).toLowerCase().includes(q.toLowerCase())), [s, q]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ d: a.d + Number(r.debit), c: a.c + Number(r.credit) }), { d: 0, c: 0 }), [rows]);

  function exportCsv() {
    const lines = [['Date', 'Description', 'Debit', 'Credit', 'Balance'], ...rows.map((r) => [r.date, `"${r.description.replace(/"/g, '""')}"`, r.debit, r.credit, r.balance])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map((l) => l.join(',')).join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `${type}-${s?.party.name ?? id}-statement.csv`; a.click(); URL.revokeObjectURL(url);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api('/vouchers', { method: 'POST', body: JSON.stringify({ party_type: type, party_id: Number(id), direction, method, amount, notes: notes || null, voucher_date: new Date().toISOString().slice(0, 10) }) });
      setAmount(''); setNotes(''); load(); }
    catch (err) { setError(err instanceof ApiError ? err : 'Could not save.'); } finally { setBusy(false); }
  }

  const ctl = 'h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  return (
    <div className="space-y-3">
      <Link href="/accounts" className="no-print text-sm text-muted">← Accounts</Link>
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-xl font-bold">{s?.party.name ?? '…'}</h1>
        {s && <span className={`text-sm font-semibold ${Number(s.balance) === 0 ? 'text-muted' : type === 'customer' ? 'text-warning' : 'text-danger'}`}>
          {Number(s.balance) === 0 ? 'Settled' : `${type === 'customer' ? 'Receivable' : 'Payable'} ${n(s.balance)}`}</span>}
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof error === 'string' ? error : error.message}{error instanceof ApiError && error.field('amount') ? `: ${error.field('amount')}` : ''}</div>}
      <form onSubmit={save} className="no-print flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction" className={ctl}><option value="receipt">Money received</option><option value="payment">Money paid</option></select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method" className={ctl}>{['cash', 'bank', 'jazzcash', 'easypaisa', 'cheque'].map((m) => <option key={m}>{m}</option>)}</select>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required className={`${ctl} w-32`} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className={`${ctl} min-w-40 flex-1`} />
        <button disabled={busy} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Record'}</button>
      </form>
      <div className="no-print space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description…" className={`${ctl} w-full pl-9`} /></div>
          <button onClick={exportCsv} className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-bg"><Download size={14} /> Export CSV</button>
          <button onClick={() => window.print()} className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-bg"><Printer size={14} /> Print</button>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-bg/60 text-left text-xs uppercase tracking-wide text-muted"><tr>{['Date', 'Description', 'Debit', 'Credit', 'Balance'].map((h, i) => <th key={h} className={`px-4 py-2.5 font-medium ${i > 1 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {s && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No entries for these filters.</td></tr>}
            {rows.map((r) => (<tr key={r.id} className="border-t border-border hover:bg-bg/50"><td className="px-4 py-2.5">{r.date}</td><td className="px-4 py-2.5">{r.description}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{cell(r.debit)}</td><td className="px-4 py-2.5 text-right tabular-nums text-success">{cell(r.credit)}</td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">{n(r.balance)}</td></tr>))}
          </tbody>
          {rows.length > 0 && <tfoot className="border-t border-border bg-bg/60 text-sm font-semibold"><tr><td colSpan={2} className="px-4 py-2.5">Totals ({rows.length} entries)</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{n(totals.d)}</td><td className="px-4 py-2.5 text-right tabular-nums text-success">{n(totals.c)}</td><td /></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
