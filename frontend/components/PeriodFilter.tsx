'use client';
import { CalendarDays } from 'lucide-react';
import { PRESETS, rangeFor } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';

export type Period = { preset: string; from: string; to: string };

export default function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CalendarDays className="mr-0.5 size-4 text-muted" />
      {PRESETS.map(([k, label]) => (
        <button key={k} onClick={() => onChange({ preset: k, ...(k === 'custom' ? { from: value.from, to: value.to } : rangeFor(k)) })}
          className={cn('h-7 rounded-full px-3 text-xs font-medium transition', value.preset === k ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-bg hover:text-text')}>{label}</button>))}
      {value.preset === 'custom' && (
        <>
          <Input type="date" aria-label="From" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-7 w-36 text-xs" />
          <span className="text-xs text-muted">to</span>
          <Input type="date" aria-label="To" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-7 w-36 text-xs" />
        </>)}
    </div>
  );
}
