'use client';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Printer, Search, X } from 'lucide-react';
import { api, ApiError, download } from '@/lib/api';
import { rangeFor } from '@/lib/dates';
import PeriodFilter, { type Period } from './PeriodFilter';

export type Col<T> = { key: string; label: string; sort?: string; align?: 'right' | 'center'; cell?: (r: T) => ReactNode };
export type Filter = { name: string; label: string; options?: { value: string; label: string }[]; type?: 'number' | 'segment' };
export type Chip = { label: string; value: string; tone?: string };
type Res<T> = { data: T[]; meta: { page: number; last_page: number; total: number; per_page: number }; totals: Record<string, string | number> };

type Props<T> = {
  title: string; actions?: ReactNode; endpoint: string; exportName: string; rowKey: (r: T) => string | number;
  cols: Col<T>[] | ((f: Record<string, string>) => Col<T>[]);
  filters?: Filter[]; initial?: Record<string, string>; dates?: boolean; defaultPeriod?: string; searchHint?: string;
  chips?: (t: Res<T>['totals']) => Chip[]; sort?: { key: string; dir: 'asc' | 'desc' }; reload?: number;
};

export default function DataTable<T>(p: Props<T>) {
  const [q, setQ] = useState(''); const [qd, setQd] = useState('');
  const [period, setPeriod] = useState<Period>({ preset: p.defaultPeriod ?? 'all', ...rangeFor(p.defaultPeriod ?? 'all') });
  const [fv, setFv] = useState<Record<string, string>>(p.initial ?? {});
  const [sort, setSort] = useState(p.sort ?? { key: 'date', dir: 'desc' as 'asc' | 'desc' });
  const [page, setPage] = useState(1); const [per, setPer] = useState(25);
  const [res, setRes] = useState<Res<T> | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQd(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    const add = (k: string, v?: string) => v && u.set(k, v);
    add('q', qd); if (p.dates) { add('from', period.from); add('to', period.to); }
    Object.entries(fv).forEach(([k, v]) => add(k, v));
    u.set('sort', sort.key); u.set('dir', sort.dir);
    return u;
  }, [qd, period, fv, sort, p.dates]);

  useEffect(() => {
    let stale = false; setLoading(true);
    api<Res<T>>(`${p.endpoint}?${qs}&page=${page}&per_page=${per}`)
      .then((r) => { if (!stale) { setRes(r); setError(null); } })
      .catch((e) => { if (!stale) setError(e instanceof ApiError ? e.message : 'Failed to load.'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [p.endpoint, qs, page, per, p.reload]);

  const cols = typeof p.cols === 'function' ? p.cols(fv) : p.cols;
  const active = (qd ? 1 : 0) + (p.dates && period.preset !== (p.defaultPeriod ?? 'all') ? 1 : 0) + Object.entries(fv).filter(([k, v]) => v && v !== p.initial?.[k]).length;
  const clear = () => { setQ(''); setQd(''); setPeriod({ preset: p.defaultPeriod ?? 'all', ...rangeFor(p.defaultPeriod ?? 'all') }); setFv(p.initial ?? {}); setPage(1); };
  const setF = (k: string, v: string) => { setFv((o) => ({ ...o, [k]: v })); setPage(1); };
  const toggle = (key: string) => { setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })); setPage(1); };
  const pages = useMemo(() => { if (!res) return []; const { page: c, last_page: l } = res.meta; const s = Math.max(1, Math.min(c - 2, l - 4)); return Array.from({ length: Math.min(5, l) }, (_, i) => s + i); }, [res]);
  const from = res ? (res.meta.page - 1) * res.meta.per_page + 1 : 0;
  const ctl = 'h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';

  async function exportCsv() {
    try { await download(`${p.endpoint}?${qs}&export=csv`, `${p.exportName}.csv`); } catch (e) { setError(e instanceof ApiError ? e.message : 'Export failed.'); }
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{p.title}</h1><div className="ml-auto flex gap-2">{p.actions}</div>
      </div>
      <div className="no-print space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.searchHint ?? 'Search…'} className={`${ctl} w-full pl-9`} />
          </div>
          {p.filters?.filter((f) => f.type !== 'segment').map((f) => f.options
            ? <select key={f.name} aria-label={f.label} value={fv[f.name] ?? ''} onChange={(e) => setF(f.name, e.target.value)} className={ctl}>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.value === '' ? f.label : o.label}</option>)}</select>
            : <input key={f.name} type="number" aria-label={f.label} placeholder={f.label} value={fv[f.name] ?? ''} onChange={(e) => setF(f.name, e.target.value)} className={`${ctl} w-36`} />)}
          {active > 0 && <button onClick={clear} className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-danger hover:bg-danger/10"><X size={14} /> Clear ({active})</button>}
        </div>
        {p.filters?.filter((f) => f.type === 'segment').map((f) => (
          <div key={f.name} className="flex flex-wrap gap-1.5">{f.options!.map((o) => (
            <button key={o.value} onClick={() => setF(f.name, o.value)} className={`h-8 rounded-lg px-3 text-xs font-medium ${(fv[f.name] ?? '') === o.value ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-bg'}`}>{o.label}</button>))}</div>))}
        {p.dates && <PeriodFilter value={period} onChange={(v) => { setPeriod(v); setPage(1); }} />}
      </div>
      {res && p.chips && (
        <div className="flex flex-wrap gap-2">{p.chips(res.totals).map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted">{c.label} <b className={`ml-1 text-sm ${c.tone ?? 'text-text'}`}>{c.value}</b></div>))}</div>)}
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className={`overflow-x-auto rounded-xl border border-border bg-card transition-opacity ${loading && res ? 'opacity-60' : ''}`}>
        <table className="w-full text-sm">
          <thead className="bg-bg/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>{cols.map((c) => {
              const on = c.sort && sort.key === c.sort; const Icon = on ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (<th key={c.key} className={`whitespace-nowrap px-4 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>
                {c.sort ? <button onClick={() => toggle(c.sort!)} className="inline-flex items-center gap-1 hover:text-text">{c.label}<Icon size={12} className={on ? 'text-primary' : 'opacity-40'} /></button> : c.label}</th>);
            })}</tr>
          </thead>
          <tbody>
            {!res && !error && Array.from({ length: 6 }, (_, i) => <tr key={i} className="border-t border-border">{cols.map((c) => <td key={c.key} className="px-4 py-3"><div className="h-3 animate-pulse rounded bg-border" /></td>)}</tr>)}
            {res?.data.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-muted">{active ? 'No results for these filters.' : 'Nothing here yet.'}</td></tr>}
            {res?.data.map((r) => (
              <tr key={p.rowKey(r)} className="border-t border-border hover:bg-bg/50">
                {cols.map((c) => <td key={c.key} className={`px-4 py-2.5 tabular-nums ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>
                  {c.cell ? c.cell(r) : String((r as Record<string, unknown>)[c.key] ?? '—')}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="no-print flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{res && res.meta.total > 0 ? `Showing ${from}–${from + res.data.length - 1} of ${res.meta.total}` : ''}</span>
        <select aria-label="Rows per page" value={per} onChange={(e) => { setPer(Number(e.target.value)); setPage(1); }} className="h-8 rounded-lg border border-border bg-bg px-2 text-xs">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}</select>
        <button onClick={exportCsv} className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:bg-bg"><Download size={14} /> Export CSV</button>
        <button onClick={() => window.print()} className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs hover:bg-bg"><Printer size={14} /> Print</button>
        {res && res.meta.last_page > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" className="h-8 w-8 rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={14} className="mx-auto" /></button>
            {pages.map((n) => <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-xs ${n === res.meta.page ? 'bg-primary text-white' : 'border border-border hover:bg-bg'}`}>{n}</button>)}
            <button disabled={page >= res.meta.last_page} onClick={() => setPage(page + 1)} aria-label="Next page" className="h-8 w-8 rounded-lg border border-border disabled:opacity-40"><ChevronRight size={14} className="mx-auto" /></button>
          </div>)}
      </div>
    </div>
  );
}
