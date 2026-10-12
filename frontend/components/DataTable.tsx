'use client';
<<<<<<< HEAD
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, Filter as FilterIcon, FilterX, Printer, Rows3, Search, SearchX, X } from 'lucide-react';
import { api, ApiError, download } from '@/lib/api';
import { PRESETS, rangeFor } from '@/lib/dates';
import { cn } from '@/lib/utils';
import PeriodFilter, { type Period } from './PeriodFilter';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Skeleton } from './ui/skeleton';
=======
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Printer, Search, X } from 'lucide-react';
import { api, ApiError, download } from '@/lib/api';
import { rangeFor } from '@/lib/dates';
import PeriodFilter, { type Period } from './PeriodFilter';
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281

export type Col<T> = { key: string; label: string; sort?: string; align?: 'right' | 'center'; cell?: (r: T) => ReactNode };
export type Filter = { name: string; label: string; options?: { value: string; label: string }[]; type?: 'number' | 'segment' };
export type Chip = { label: string; value: string; tone?: string };
type Res<T> = { data: T[]; meta: { page: number; last_page: number; total: number; per_page: number }; totals: Record<string, string | number> };
<<<<<<< HEAD
type Range = { min: string; max: string };
type Inline = { text: Record<string, string>; range: Record<string, Range> };
=======
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281

type Props<T> = {
  title: string; actions?: ReactNode; endpoint: string; exportName: string; rowKey: (r: T) => string | number;
  cols: Col<T>[] | ((f: Record<string, string>) => Col<T>[]);
  filters?: Filter[]; initial?: Record<string, string>; dates?: boolean; defaultPeriod?: string; searchHint?: string;
  chips?: (t: Res<T>['totals']) => Chip[]; sort?: { key: string; dir: 'asc' | 'desc' }; reload?: number;
};

<<<<<<< HEAD
function useDebounced<V>(value: V, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
/** Which header filter a column gets: money range (right aligned), number range (centered) or "contains" text. Date and action columns are handled elsewhere. */
const kindOf = (c: { key: string; sort?: string; align?: string }) =>
  !c.sort || c.key === 'date' || c.key === 'x' ? null : c.align === 'right' ? 'money' : c.align === 'center' ? 'int' : 'text';
const tone: Record<string, string> = { 'text-success': 'bg-success', 'text-danger': 'bg-danger', 'text-warning': 'bg-warning', 'text-primary': 'bg-primary' };

export default function DataTable<T>(p: Props<T>) {
  const defPeriod = p.defaultPeriod ?? 'all';
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>({ preset: defPeriod, ...rangeFor(defPeriod) });
  const [fv, setFv] = useState<Record<string, string>>(p.initial ?? {});
  const [inline, setInline] = useState<Inline>({ text: {}, range: {} });
  const [sort, setSort] = useState(p.sort ?? { key: 'date', dir: 'desc' as 'asc' | 'desc' });
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState({ key: '', page: 1 });
  const [res, setRes] = useState<Res<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInline, setShowInline] = useState(true);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dense, setDense] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const store = `dt:${p.exportName}`;

  const dq = useDebounced(q, 300);
  const di = useDebounced(inline, 350);
  const all = typeof p.cols === 'function' ? p.cols(fv) : p.cols;
  const cols = all.filter((c) => !hidden.includes(c.key));

  // remembered per table: hidden columns, density, whether the filter row is open
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(store) ?? '{}'); setHidden(s.hidden ?? []); setDense(!!s.dense); setShowInline(s.showInline ?? true); } catch { /* ignore */ }
  }, [store]);
  const remember = (patch: object) => { try { localStorage.setItem(store, JSON.stringify({ hidden, dense, showInline, ...patch })); } catch { /* ignore */ } };

  // "/" jumps to search, like GitHub
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
=======
export default function DataTable<T>(p: Props<T>) {
  const [q, setQ] = useState(''); const [qd, setQd] = useState('');
  const [period, setPeriod] = useState<Period>({ preset: p.defaultPeriod ?? 'all', ...rangeFor(p.defaultPeriod ?? 'all') });
  const [fv, setFv] = useState<Record<string, string>>(p.initial ?? {});
  const [sort, setSort] = useState(p.sort ?? { key: 'date', dir: 'desc' as 'asc' | 'desc' });
  const [page, setPage] = useState(1); const [per, setPer] = useState(25);
  const [res, setRes] = useState<Res<T> | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQd(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    const add = (k: string, v?: string) => v && u.set(k, v);
<<<<<<< HEAD
    add('q', dq); if (p.dates) { add('from', period.from); add('to', period.to); }
    Object.entries(fv).forEach(([k, v]) => add(k, v));
    Object.entries(di.text).forEach(([k, v]) => add(`cf[${k}]`, v.trim()));
    const cents = (k: string, v: string) => (all.find((c) => c.sort === k)?.align === 'right' ? String(Math.round(Number(v) * 100)) : v); // money columns are stored in paisa
    Object.entries(di.range).forEach(([k, r]) => { r.min !== '' && add(`cfmin[${k}]`, cents(k, r.min)); r.max !== '' && add(`cfmax[${k}]`, cents(k, r.max)); });
    u.set('sort', sort.key); u.set('dir', sort.dir);
    return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, period, fv, di, sort, p.dates]);

  const filterKey = qs.toString() + per; // any filter change sends you back to page 1 without an extra request
  const page = pg.key === filterKey ? pg.page : 1;
=======
    add('q', qd); if (p.dates) { add('from', period.from); add('to', period.to); }
    Object.entries(fv).forEach(([k, v]) => add(k, v));
    u.set('sort', sort.key); u.set('dir', sort.dir);
    return u;
  }, [qd, period, fv, sort, p.dates]);
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281

  useEffect(() => {
    let stale = false; setLoading(true);
    api<Res<T>>(`${p.endpoint}?${qs}&page=${page}&per_page=${per}`)
      .then((r) => { if (!stale) { setRes(r); setError(null); } })
      .catch((e) => { if (!stale) setError(e instanceof ApiError ? e.message : 'Failed to load.'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [p.endpoint, qs, page, per, p.reload]);

<<<<<<< HEAD
  const setF = (k: string, v: string) => setFv((o) => ({ ...o, [k]: v }));
  const setText = (k: string, v: string) => setInline((o) => ({ ...o, text: { ...o.text, [k]: v } }));
  const setRange = (k: string, part: keyof Range, v: string) => setInline((o) => ({ ...o, range: { ...o.range, [k]: { ...(o.range[k] ?? { min: '', max: '' }), [part]: v } } }));
  const toggle = (key: string) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const labelOf = (k: string) => all.find((c) => c.sort === k)?.label ?? k;

  // every active filter, as a removable chip
  const active: { id: string; label: string; clear: () => void }[] = [];
  dq && active.push({ id: 'q', label: `Search “${dq}”`, clear: () => setQ('') });
  p.dates && period.preset !== defPeriod && active.push({ id: 'period', label: period.preset === 'custom' ? `${period.from || '…'} → ${period.to || '…'}` : (PRESETS.find(([k]) => k === period.preset)?.[1] ?? period.preset), clear: () => setPeriod({ preset: defPeriod, ...rangeFor(defPeriod) }) });
  p.filters?.forEach((f) => { const v = fv[f.name]; v && v !== p.initial?.[f.name] && active.push({ id: f.name, label: `${f.label.replace(/^(All|Any) /i, '')}: ${f.options?.find((o) => o.value === v)?.label ?? v}`, clear: () => setF(f.name, p.initial?.[f.name] ?? '') }); });
  Object.entries(inline.text).forEach(([k, v]) => v && active.push({ id: `t${k}`, label: `${labelOf(k)} contains “${v}”`, clear: () => setText(k, '') }));
  Object.entries(inline.range).forEach(([k, r]) => (r.min !== '' || r.max !== '') && active.push({ id: `r${k}`, label: `${labelOf(k)} ${r.min !== '' ? `≥ ${r.min}` : ''} ${r.max !== '' ? `≤ ${r.max}` : ''}`.trim(), clear: () => setInline((o) => ({ ...o, range: { ...o.range, [k]: { min: '', max: '' } } })) }));
  const clearAll = () => { setQ(''); setPeriod({ preset: defPeriod, ...rangeFor(defPeriod) }); setFv(p.initial ?? {}); setInline({ text: {}, range: {} }); };

  const pages = useMemo(() => { if (!res) return []; const { page: c, last_page: l } = res.meta; const s = Math.max(1, Math.min(c - 2, l - 4)); return Array.from({ length: Math.min(5, l) }, (_, i) => s + i); }, [res]);
  const start = res ? (res.meta.page - 1) * res.meta.per_page + 1 : 0;
  const inlineActive = Object.values(inline.text).some(Boolean) || Object.values(inline.range).some((r) => r.min !== '' || r.max !== '');
  const cell = dense ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  const align = (c: Col<T>) => (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '');

  async function exportCsv() { try { await download(`${p.endpoint}?${qs}&export=csv`, `${p.exportName}.csv`); } catch (e) { setError(e instanceof ApiError ? e.message : 'Export failed.'); } }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold tracking-tight">{p.title}</h1><div className="ml-auto flex gap-2">{p.actions}</div></div>

      <Card className="no-print space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted" />
            <Input ref={searchRef as never} value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.searchHint ?? 'Search…'} className="pl-9 pr-9" />
            {q ? <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-2.5 text-muted hover:text-text"><X className="size-4" /></button>
              : <kbd className="absolute right-2.5 top-2 hidden rounded border border-border px-1.5 text-[10px] leading-5 text-muted sm:block">/</kbd>}
          </div>
          {p.filters?.filter((f) => f.type !== 'segment').map((f) => f.options
            ? <Select key={f.name} aria-label={f.label} value={fv[f.name] ?? ''} onChange={(e) => setF(f.name, e.target.value)} className="w-44">{f.options.map((o) => <option key={o.value} value={o.value}>{o.value === '' ? f.label : o.label}</option>)}</Select>
            : <Input key={f.name} type="number" aria-label={f.label} placeholder={f.label} value={fv[f.name] ?? ''} onChange={(e) => setF(f.name, e.target.value)} className="w-36" />)}
          <div className="ml-auto flex items-center gap-1">
            <Button variant={showInline ? 'subtle' : 'outline'} size="sm" onClick={() => { setShowInline(!showInline); remember({ showInline: !showInline }); }}><FilterIcon />Filters{inlineActive && <span className="size-1.5 rounded-full bg-primary" />}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 />Columns</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Show columns</DropdownMenuLabel><DropdownMenuSeparator />
                {all.filter((c) => c.label).map((c) => (
                  <DropdownMenuCheckboxItem key={c.key} checked={!hidden.includes(c.key)} onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(on) => { const h = on ? hidden.filter((k) => k !== c.key) : [...hidden, c.key]; setHidden(h); remember({ hidden: h }); }}>{c.label}</DropdownMenuCheckboxItem>))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" className="size-8" aria-label="Compact rows" aria-pressed={dense} onClick={() => { setDense(!dense); remember({ dense: !dense }); }}><Rows3 className={dense ? 'text-primary' : ''} /></Button>
          </div>
        </div>
        {p.filters?.filter((f) => f.type === 'segment').map((f) => (
          <div key={f.name} className="flex flex-wrap gap-1.5">{f.options!.map((o) => (
            <button key={o.value} onClick={() => setF(f.name, o.value)} className={cn('h-7 rounded-full px-3 text-xs font-medium transition', (fv[f.name] ?? '') === o.value ? 'bg-primary text-white shadow-sm' : 'border border-border text-muted hover:bg-bg hover:text-text')}>{o.label}</button>))}</div>))}
        {p.dates && <PeriodFilter value={period} onChange={setPeriod} />}
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            {active.map((a) => <Badge key={a.id} variant="default" className="gap-1 py-1 pl-2.5 pr-1.5">{a.label}<button onClick={a.clear} aria-label={`Remove ${a.label}`} className="rounded-full p-0.5 hover:bg-primary/20"><X className="size-3" /></button></Badge>)}
            <Button variant="ghost" size="xs" onClick={clearAll} className="text-danger hover:bg-danger/10"><FilterX />Clear all</Button>
          </div>)}
      </Card>

      {res && p.chips && (
        <div className="flex flex-wrap gap-2">{p.chips(res.totals).map((c) => (
          <Card key={c.label} className="flex items-center gap-2 px-3 py-2 text-xs text-muted"><span className={cn('size-2 rounded-full', tone[c.tone ?? ''] ?? 'bg-muted')} />{c.label}<b className={cn('text-sm tabular-nums', c.tone ?? 'text-text')}>{c.value}</b></Card>))}</div>)}
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <Card className={cn('overflow-hidden transition-opacity', loading && res && 'opacity-60')}>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-card text-left text-xs uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]">
              <tr>{cols.map((c) => {
                const on = c.sort && sort.key === c.sort; const Icon = on ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (<th key={c.key} className={cn('whitespace-nowrap font-medium', cell, align(c))}>
                  {c.sort ? <button onClick={() => toggle(c.sort!)} className="inline-flex items-center gap-1 transition hover:text-text">{c.label}<Icon className={cn('size-3', on ? 'text-primary' : 'opacity-40')} /></button> : c.label}</th>);
              })}</tr>
              {showInline && (
                <tr className="no-print bg-bg/50 normal-case">{cols.map((c) => { const k = kindOf(c); return (
                  <th key={c.key} className="px-2 py-1.5 font-normal">
                    {k === 'text' && <Input aria-label={`Filter ${c.label}`} placeholder="Filter…" value={inline.text[c.sort!] ?? ''} onChange={(e) => setText(c.sort!, e.target.value)} className="h-7 min-w-24 text-xs" />}
                    {(k === 'money' || k === 'int') && (
                      <div className="flex gap-1">{(['min', 'max'] as const).map((part) => (
                        <Input key={part} type="number" min={0} aria-label={`${c.label} ${part}`} placeholder={part === 'min' ? 'Min' : 'Max'} value={inline.range[c.sort!]?.[part] ?? ''} onChange={(e) => setRange(c.sort!, part, e.target.value)} className="h-7 w-14 px-1.5 text-xs" />))}</div>)}
                  </th>); })}</tr>)}
            </thead>
            <tbody>
              {!res && !error && Array.from({ length: 7 }, (_, i) => <tr key={i} className="border-t border-border">{cols.map((c) => <td key={c.key} className={cell}><Skeleton className="h-3.5 w-full max-w-32" /></td>)}</tr>)}
              {res?.data.length === 0 && (
                <tr><td colSpan={cols.length} className="px-4 py-14 text-center">
                  <div className="mx-auto flex max-w-xs flex-col items-center gap-2 text-muted">
                    {active.length ? <SearchX className="size-9 opacity-60" /> : <Rows3 className="size-9 opacity-60" />}
                    <div className="text-sm font-medium text-text">{active.length ? 'Nothing matches these filters' : 'Nothing here yet'}</div>
                    {active.length > 0 && <Button variant="outline" size="sm" onClick={clearAll}><FilterX />Clear filters</Button>}
                  </div></td></tr>)}
              {res?.data.map((r) => (
                <tr key={p.rowKey(r)} className="border-t border-border transition-colors hover:bg-bg/60">
                  {cols.map((c) => <td key={c.key} className={cn('whitespace-nowrap tabular-nums', cell, align(c))}>{c.cell ? c.cell(r) : String((r as Record<string, unknown>)[c.key] ?? '—')}</td>)}
                </tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="no-print flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{res && res.meta.total > 0 ? `Showing ${start}–${start + res.data.length - 1} of ${res.meta.total}` : ''}</span>
        <Select aria-label="Rows per page" value={String(per)} onChange={(e) => setPer(Number(e.target.value))} className="w-28 [&_select]:h-8 [&_select]:text-xs">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}</Select>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download />Export CSV</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer />Print</Button>
        {res && res.meta.last_page > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => setPg({ key: filterKey, page: page - 1 })} aria-label="Previous page"><ChevronLeft /></Button>
            {pages.map((n) => <Button key={n} variant={n === res.meta.page ? 'default' : 'outline'} size="icon" className="size-8 text-xs" onClick={() => setPg({ key: filterKey, page: n })}>{n}</Button>)}
            <Button variant="outline" size="icon" className="size-8" disabled={page >= res.meta.last_page} onClick={() => setPg({ key: filterKey, page: page + 1 })} aria-label="Next page"><ChevronRight /></Button>
=======
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
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
          </div>)}
      </div>
    </div>
  );
}
