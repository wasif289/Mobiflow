'use client';
import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type Row = { id: number; name: string; brand?: { name: string }; device_model?: { name: string } };
export type Cfg = { key: string; label: string; parent?: { resource: string; field: string; label: string } };

export default function CatalogManager({ cfg }: { cfg: Cfg }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [parents, setParents] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await api<{ data: Row[] }>(`/catalog/${cfg.key}`)).data);
      if (cfg.parent) setParents((await api<{ data: Row[] }>(`/catalog/${cfg.parent.resource}`)).data);
    } catch (e) { setError(e as ApiError); } finally { setLoading(false); }
  }, [cfg]);

  useEffect(() => { setError(null); setName(''); setParentId(''); load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await api(`/catalog/${cfg.key}`, {
        method: 'POST',
        body: JSON.stringify({ name, ...(cfg.parent && { [cfg.parent.field]: Number(parentId) }) }),
      });
      setName(''); load();
    } catch (err) { setError(err as ApiError); }
  }

  async function remove(r: Row) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    setError(null);
    try { await api(`/catalog/${cfg.key}/${r.id}`, { method: 'DELETE' }); load(); }
    catch (err) { setError(err as ApiError); }
  }

  const input = 'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
  return (
    <div className="space-y-3">
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        {error.message}{error.field?.('name') && `: ${error.field('name')}`}</div>}
      <form onSubmit={add} className="flex flex-wrap gap-2">
        {cfg.parent && (
          <select aria-label={cfg.parent.label} value={parentId} onChange={(e) => setParentId(e.target.value)} className={input} required>
            <option value="">{cfg.parent.label}…</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${cfg.label.toLowerCase().replace(/s$/, '')}`} className={`${input} min-w-48 flex-1`} required />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      <div className="rounded-xl border border-border bg-card">
        {loading ? <p className="p-4 text-sm text-muted">Loading…</p>
          : rows.length === 0 ? <p className="p-4 text-sm text-muted">Nothing here yet. Add the first one above.</p>
          : rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-0">
              <span className="flex-1 text-sm">{r.name}
                {(r.brand ?? r.device_model) && <span className="ml-2 text-xs text-muted">{(r.brand ?? r.device_model)!.name}</span>}
              </span>
              <button onClick={() => remove(r)} aria-label={`Delete ${r.name}`} className="rounded p-1.5 text-muted hover:text-danger"><Trash2 size={16} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}
