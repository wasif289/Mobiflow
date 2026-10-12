'use client';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import DataTable, { type Col } from '@/components/DataTable';
import { api, ApiError } from '@/lib/api';
import { n } from '@/lib/format';
import { useSession } from '@/lib/session';

type E = { id: number; date: string; head: string; notes: string | null; amount: string; by: string };
type Head = { id: number; name: string };

export default function Expenses() {
  const admin = ['owner', 'admin'].includes(useSession((s) => s.user?.role) ?? '');
  const [heads, setHeads] = useState<Head[]>([]); const [reload, setReload] = useState(0);
  const [head, setHead] = useState(''); const [amount, setAmount] = useState(''); const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api<Head[]>('/expense-heads').then(setHeads); }, []);

  async function addHead() {
    const name = window.prompt('New expense head (e.g. Rent, Electricity, Salary)'); if (!name) return;
    try { const h = await api<Head>('/expense-heads', { method: 'POST', body: JSON.stringify({ name }) }); setHeads((x) => [...x, h]); setHead(String(h.id)); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not add head.'); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api('/expenses', { method: 'POST', body: JSON.stringify({ expense_head_id: Number(head), amount, expense_date: date, notes: notes || null }) });
      setAmount(''); setNotes(''); setReload((x) => x + 1); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save.'); } finally { setBusy(false); }
  }
  async function remove(r: E) {
    if (!confirm(`Delete ${n(r.amount)} (${r.head})?`)) return;
    try { await api(`/expenses/${r.id}`, { method: 'DELETE' }); setReload((x) => x + 1); } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not delete.'); }
  }

  const cols: Col<E>[] = [
    { key: 'date', label: 'Date', sort: 'date' }, { key: 'head', label: 'Head', sort: 'head' }, { key: 'notes', label: 'Notes', cell: (r) => r.notes ?? '—' },
    { key: 'amount', label: 'Amount', sort: 'amount', align: 'right', cell: (r) => <b className="text-danger">{n(r.amount)}</b> }, { key: 'by', label: 'By' },
    ...(admin ? [{ key: 'x', label: '', align: 'right' as const, cell: (r: E) => <button onClick={() => remove(r)} aria-label="Delete expense" className="p-1 text-muted hover:text-danger"><Trash2 size={15} /></button> }] : []),
  ];
  const ctl = 'h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  return (
    <div className="space-y-4">
      <form onSubmit={save} className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <select aria-label="Head" value={head} onChange={(e) => setHead(e.target.value)} required className={ctl}><option value="">Expense head…</option>{heads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
        <button type="button" onClick={addHead} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-bg">+ Head</button>
        <input inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className={`${ctl} w-32`} />
        <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={ctl} />
        <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${ctl} min-w-40 flex-1`} />
        <button disabled={busy} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Add expense'}</button>
        {error && <span role="alert" className="w-full text-sm text-danger">{error}</span>}
      </form>
      <DataTable<E> title="Expenses" endpoint="/expenses" exportName="expenses" rowKey={(r) => r.id} cols={cols} dates defaultPeriod="month" reload={reload}
        sort={{ key: 'date', dir: 'desc' }} searchHint="Search head or notes…"
        filters={[{ name: 'head_id', label: 'All heads', options: [{ value: '', label: '' }, ...heads.map((h) => ({ value: String(h.id), label: h.name }))] }]}
        chips={(t) => [{ label: 'Entries', value: String(t.count) }, { label: 'Total', value: n(t.total), tone: 'text-danger' }]} />
    </div>
  );
}
