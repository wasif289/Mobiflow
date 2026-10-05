'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type Opt = { id: number; name: string; brand?: { name: string } };
type Line = { imei: string; modelId: string; colorId: string; cost: string };
type Lookup = { imei: string; model: { id: number } | null };

export default function NewPurchase() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Opt[]>([]);
  const [models, setModels] = useState<Opt[]>([]);
  const [colors, setColors] = useState<Opt[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paid, setPaid] = useState('');
  const [defCost, setDefCost] = useState('');
  const [scan, setScan] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Opt[]>('/suppliers').then(setSuppliers);
    api<{ data: Opt[] }>('/catalog/models').then((r) => setModels(r.data));
    api<{ data: Opt[] }>('/catalog/colors').then((r) => setColors(r.data));
  }, []);

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.cost) || 0), 0), [lines]);

  async function addScan(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const raw = scan.replace(/\D/g, '');
    if (lines.some((l) => l.imei === raw)) { setError(`${raw} is already in this list.`); return; }
    try {
      const r = await api<Lookup>(`/imei/${raw}`); // validates + auto-detects model
      setLines((l) => [...l, { imei: r.imei, modelId: r.model ? String(r.model.id) : '', colorId: '', cost: defCost }]);
      setScan('');
    } catch (err) { setError(err instanceof ApiError ? err : 'Lookup failed.'); }
  }
  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function addSupplier() {
    const name = window.prompt('Supplier name'); if (!name) return;
    try { const s = await api<Opt>('/suppliers', { method: 'POST', body: JSON.stringify({ name }) });
      setSuppliers((x) => [...x, s]); setSupplierId(String(s.id)); }
    catch (err) { setError(err instanceof ApiError ? err : 'Could not add supplier.'); }
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      await api('/purchases', { method: 'POST', body: JSON.stringify({
        supplier_id: Number(supplierId), purchase_date: date, paid: paid || '0',
        items: lines.map((l) => ({ imei: l.imei, device_model_id: Number(l.modelId), color_id: l.colorId ? Number(l.colorId) : null, cost: l.cost })),
      }) });
      router.replace('/purchases');
    } catch (err) { setError(err instanceof ApiError ? err : 'Could not save.'); } finally { setBusy(false); }
  }

  const ready = supplierId && lines.length > 0 && lines.every((l) => l.modelId && l.cost);
  const input = 'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
  const imeiErrors = error instanceof ApiError ? error.problem.errors?.imei : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New purchase</h1>
      {error && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {typeof error === 'string' ? error : error.message}
          {imeiErrors && <ul className="mt-1 list-disc pl-5 text-xs">{imeiErrors.map((m) => <li key={m}>{m}</li>)}</ul>}
        </div>)}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
        <div className="flex gap-2 sm:col-span-2">
          <select aria-label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${input} flex-1`}>
            <option value="">Supplier…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" onClick={addSupplier} className="rounded-lg border border-border px-3 text-sm hover:bg-bg">+ New</button>
        </div>
        <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        <input inputMode="decimal" placeholder="Default cost" value={defCost} onChange={(e) => setDefCost(e.target.value)} className={input} />
      </div>
      <form onSubmit={addScan} className="flex gap-2">
        <input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} inputMode="numeric" placeholder="Scan or type IMEI, press Enter" className={`${input} flex-1`} />
        <button className="rounded-lg border border-border px-4 text-sm hover:bg-bg">Add</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {lines.length === 0 ? <p className="p-4 text-sm text-muted">No phones added yet.</p> : lines.map((l, i) => (
          <div key={l.imei} className="flex flex-wrap items-center gap-2 border-b border-border p-2 last:border-0">
            <span className="w-40 text-sm font-medium">{l.imei}</span>
            <select aria-label="Model" value={l.modelId} onChange={(e) => patch(i, { modelId: e.target.value })} className={`${input} w-48`}>
              <option value="">Model…</option>{models.map((m) => <option key={m.id} value={m.id}>{m.brand?.name} {m.name}</option>)}
            </select>
            <select aria-label="Color" value={l.colorId} onChange={(e) => patch(i, { colorId: e.target.value })} className={`${input} w-32`}>
              <option value="">Color…</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input aria-label="Cost" inputMode="decimal" value={l.cost} onChange={(e) => patch(i, { cost: e.target.value })} placeholder="Cost" className={`${input} w-28`} />
            <button aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="ml-auto p-1.5 text-muted hover:text-danger"><X size={16} /></button>
          </div>))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">{lines.length} phones</span>
        <span className="text-lg font-bold">Total {total.toLocaleString('en-PK')}</span>
        <input inputMode="decimal" placeholder="Paid now" value={paid} onChange={(e) => setPaid(e.target.value)} className={`${input} w-32`} />
        <button disabled={!ready || busy} onClick={save} className="ml-auto rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save purchase'}</button>
      </div>
    </div>
  );
}
