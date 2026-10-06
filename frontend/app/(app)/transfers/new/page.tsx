'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

type Br = { id: number; name: string };
type Line = { imei: string; label: string };
type Stock = { imei: string; model: string; color: string | null };

export default function NewTransfer() {
  const router = useRouter();
  const branchId = useSession((s) => s.branchId);
  const [branches, setBranches] = useState<Br[]>([]);
  const [to, setTo] = useState(''); const [note, setNote] = useState(''); const [scan, setScan] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<ApiError | string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api<Br[]>('/transfers/branches').then((b) => setBranches(b.filter((x) => x.id !== branchId))); }, [branchId]);

  async function addScan(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const raw = scan.replace(/\D/g, '');
    if (lines.some((l) => l.imei === raw)) { setErr(`${raw} is already in this transfer.`); return; }
    try { const s = await api<Stock>(`/transfers/lookup/${raw}`); setLines((l) => [...l, { imei: s.imei, label: `${s.model}${s.color ? ' · ' + s.color : ''}` }]); setScan(''); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Lookup failed.'); }
  }
  async function send() {
    setBusy(true); setErr(null);
    try { await api('/transfers', { method: 'POST', body: JSON.stringify({ to_branch_id: Number(to), note: note || null, imeis: lines.map((l) => l.imei) }) }); router.replace('/transfers'); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Could not send.'); } finally { setBusy(false); }
  }
  const imeiErrors = err instanceof ApiError ? err.problem.errors?.imei : undefined;
  const ctl = 'h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New transfer</h1>
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof err === 'string' ? err : err.message}
        {imeiErrors && <ul className="mt-1 list-disc pl-5 text-xs">{imeiErrors.map((m) => <li key={m}>{m}</li>)}</ul>}</div>}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <select aria-label="Send to" value={to} onChange={(e) => setTo(e.target.value)} className={ctl}><option value="">Send to branch…</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input className={`${ctl} sm:col-span-2`} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <form onSubmit={addScan} className="flex gap-2">
        <input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} inputMode="numeric" placeholder="Scan or type IMEI, press Enter" className={`${ctl} flex-1`} />
        <button className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-bg">Add</button>
      </form>
      <div className="rounded-xl border border-border bg-card">
        {lines.length === 0 ? <p className="p-4 text-sm text-muted">Scan the phones you are sending.</p> : lines.map((l, i) => (
          <div key={l.imei} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-0"><b className="w-40 text-sm">{l.imei}</b><span className="flex-1 text-sm text-muted">{l.label}</span>
            <button aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="p-1 text-muted hover:text-danger"><X size={16} /></button></div>))}
      </div>
      <div className="flex items-center gap-3"><span className="text-sm text-muted">{lines.length} phones</span>
        <button disabled={!to || lines.length === 0 || busy} onClick={send} className="ml-auto h-9 rounded-lg bg-primary px-6 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send transfer'}</button></div>
      <p className="text-xs text-muted">Sent phones are held "in transit" (they cannot be sold) until the other branch receives them.</p>
    </div>
  );
}
