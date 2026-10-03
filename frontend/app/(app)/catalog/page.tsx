'use client';
import { useState } from 'react';
import CatalogManager, { type Cfg } from '@/components/CatalogManager';
import { api, ApiError } from '@/lib/api';

const TABS: Cfg[] = [
  { key: 'brands', label: 'Brands' },
  { key: 'models', label: 'Models', parent: { resource: 'brands', field: 'brand_id', label: 'Brand' } },
  { key: 'variants', label: 'Variants', parent: { resource: 'models', field: 'device_model_id', label: 'Model' } },
  { key: 'colors', label: 'Colors' },
];
type Lookup = { imei: string; tac: string; model: { name: string; brand: string } | null };

export default function CatalogPage() {
  const [tab, setTab] = useState(TABS[0]);
  const [imei, setImei] = useState('');
  const [res, setRes] = useState<Lookup | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setRes(null);
    try { setRes(await api<Lookup>(`/imei/${encodeURIComponent(imei)}`)); }
    catch (x) { setErr(x instanceof ApiError ? x.message : 'Lookup failed.'); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Catalog</h1>
      <form onSubmit={check} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <input value={imei} onChange={(e) => setImei(e.target.value)} inputMode="numeric" placeholder="Check an IMEI"
          className="min-w-56 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary" />
        <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg">Look up</button>
        {err && <span className="text-sm text-danger">{err}</span>}
        {res && <span className="text-sm">{res.model ? `${res.model.brand} ${res.model.name}` : `Valid IMEI, no model mapped for TAC ${res.tac}`}</span>}
      </form>
      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={t.key === tab.key} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm ${t.key === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}>{t.label}</button>
        ))}
      </div>
      <CatalogManager cfg={tab} />
    </div>
  );
}
