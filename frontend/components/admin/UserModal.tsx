'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

type Meta = { modules: Record<string, string[]>; presets: Record<string, string[]> };
type Br = { id: number; name: string; is_active: boolean };
type Form = { name: string; username: string; password: string; role: string; is_active: boolean; branch_ids: number[]; permissions: string[] };
const ACTIONS = ['view', 'create', 'manage', 'delete'];
const flip = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

export default function UserModal({ id, onClose, onSaved }: { id: number | null; onClose: () => void; onSaved: () => void }) {
  const isOwner = useSession((s) => s.user?.role) === 'owner';
  const [meta, setMeta] = useState<Meta | null>(null);
  const [branches, setBranches] = useState<Br[]>([]);
  const [f, setF] = useState<Form>({ name: '', username: '', password: '', role: 'staff', is_active: true, branch_ids: [], permissions: [] });
  const [err, setErr] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);
  const ownerRow = f.role === 'owner';

  useEffect(() => {
    api<Meta>('/admin/permissions-meta').then(setMeta);
    api<Br[]>('/admin/branches').then((b) => setBranches(b.filter((x) => x.is_active)));
    if (id) api<Form>(`/admin/users/${id}`).then((d) => setF({ ...d, password: '' })).catch((e) => setErr(e instanceof ApiError ? e : 'Failed to load.'));
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const body = { name: f.name, ...(id ? {} : { username: f.username }), ...(f.password ? { password: f.password } : {}),
      ...(ownerRow ? {} : { role: f.role, is_active: f.is_active }), branch_ids: f.branch_ids, permissions: f.permissions };
    try { await api(id ? `/admin/users/${id}` : '/admin/users', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); onSaved(); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Could not save.'); } finally { setBusy(false); }
  }

  const fe = (k: string) => (err instanceof ApiError ? err.field(k) : undefined);
  const ctl = 'h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  const Err = ({ k }: { k: string }) => (fe(k) ? <span className="text-xs text-danger">{fe(k)}</span> : null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5">
        <div className="flex items-center"><h2 className="text-lg font-bold">{id ? 'Edit user' : 'New user'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto p-1 text-muted hover:text-text"><X size={18} /></button></div>
        {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof err === 'string' ? err : err.message}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Full name<input className={ctl} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /><Err k="name" /></label>
          <label className="text-sm">Username<input className={ctl} value={f.username} disabled={!!id} onChange={(e) => setF({ ...f, username: e.target.value })} required /><Err k="username" /></label>
          <label className="text-sm">{id ? 'New password (leave blank to keep)' : 'Password (8+ characters)'}
            <input type="password" className={ctl} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={!id} autoComplete="new-password" /><Err k="password" /></label>
          <label className="text-sm">Role
            {ownerRow ? <div className="flex h-9 items-center text-sm text-muted">Owner (full access)</div>
              : <select className={ctl} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  <option value="staff">Staff (limited)</option>{(isOwner || f.role === 'admin') && <option value="admin">Admin (full access)</option>}</select>}</label>
        </div>
        {id && !ownerRow && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Active (inactive users are signed out and cannot log in)</label>}
        <div><div className="mb-1 text-sm font-medium">Branches {f.role === 'staff' && <span className="text-xs font-normal text-muted">staff only see the branches ticked here</span>}</div>
          <div className="flex flex-wrap gap-2">{branches.map((b) => (
            <label key={b.id} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
              <input type="checkbox" checked={f.branch_ids.includes(b.id)} onChange={() => setF({ ...f, branch_ids: flip(f.branch_ids, b.id) })} />{b.name}</label>))}</div><Err k="branch_ids" /></div>
        {f.role === 'staff' && meta && (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Permissions</span>
              {Object.entries(meta.presets).map(([n, p]) => <button key={n} type="button" onClick={() => setF({ ...f, permissions: p })} className="h-7 rounded-lg border border-border px-2.5 text-xs hover:bg-bg">{n}</button>)}
              <button type="button" onClick={() => setF({ ...f, permissions: [] })} className="h-7 rounded-lg px-2.5 text-xs text-danger hover:bg-danger/10">Clear</button></div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm"><thead className="bg-bg/60 text-xs uppercase text-muted"><tr><th className="px-3 py-2 text-left font-medium">Area</th>{ACTIONS.map((a) => <th key={a} className="px-3 py-2 font-medium">{a}</th>)}</tr></thead>
                <tbody>{Object.entries(meta.modules).map(([m, acts]) => (
                  <tr key={m} className="border-t border-border"><td className="px-3 py-2 capitalize">{m}</td>
                    {ACTIONS.map((a) => <td key={a} className="px-3 py-2 text-center">{acts.includes(a) &&
                      <input type="checkbox" aria-label={`${m} ${a}`} checked={f.permissions.includes(`${m}.${a}`)} onChange={() => setF({ ...f, permissions: flip(f.permissions, `${m}.${a}`) })} />}</td>)}</tr>))}</tbody></table></div>
            <p className="mt-1 text-xs text-muted">Cost price and profit are only ever visible to owner and admins.</p>
          </div>)}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-bg">Cancel</button>
          <button disabled={busy} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save user'}</button></div>
      </form>
    </div>
  );
}
