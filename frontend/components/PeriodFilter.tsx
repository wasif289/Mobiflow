'use client';
import { PRESETS, rangeFor } from '@/lib/dates';

export type Period = { preset: string; from: string; to: string };

export default function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const input = 'h-8 rounded-lg border border-border bg-bg px-2 text-xs outline-none focus:border-primary';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map(([k, label]) => (
        <button key={k} onClick={() => onChange({ preset: k, ...(k === 'custom' ? { from: value.from, to: value.to } : rangeFor(k)) })}
          className={`h-8 rounded-lg px-3 text-xs font-medium transition ${value.preset === k ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-bg'}`}>{label}</button>))}
      {value.preset === 'custom' && (
        <>
          <input type="date" aria-label="From" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className={input} />
          <span className="text-xs text-muted">to</span>
          <input type="date" aria-label="To" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className={input} />
        </>)}
    </div>
  );
}
