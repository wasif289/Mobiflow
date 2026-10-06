'use client';
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { n } from '@/lib/format';

type Plan = { id: number; name: string; max_users: number | null; max_branches: number | null; currency: string; price: string; yearly_price: string };
type Inv = { id: number; invoice_no: string; date: string; status: string; months: number; amount: string; currency: string; plan: string; payment_status: string | null; review_note: string | null };
type Data = { subscription: { status: string; plan: string; trial_ends_at: string | null; period_ends_at: string | null }; plans: Plan[]; invoices: Inv[];
  options: { gateway: string | null; manual: { key: string; label: string; details: string }[] } };
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-PK') : '—');
const badge: Record<string, string> = { paid: 'bg-success/15 text-success', pending: 'bg-warning/15 text-warning', cancelled: 'bg-muted/20 text-muted', rejected: 'bg-danger/15 text-danger' };

export default function Billing() {
  const [d, setD] = useState<Data | null>(null);
  const [months, setMonths] = useState<1 | 12>(1);
  const [pay, setPay] = useState<{ id: number; amount: string; currency: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { api<Data>('/billing').then(setD).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load.')); }, []);
  useEffect(load, [load]);

  async function choose(p: Plan) {
    setErr(null);
    try { const r = await api<{ id: number }>('/billing/invoices', { method: 'POST', body: JSON.stringify({ plan_id: p.id, months }) });
      setPay({ id: r.id, amount: months === 12 ? p.yearly_price : p.price, currency: p.currency }); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not create the invoice.'); }
  }
  const open = d?.invoices.find((i) => i.status === 'pending' && i.payment_status !== 'pending');
  const s = d?.subscription;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Billing</h1>
      {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') && <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">Thanks! Your payment is being confirmed and your plan will update in a moment.</div>}
      {s && <div className="grid gap-3 sm:grid-cols-4">{[['Plan', s.plan], ['Status', s.status.replace('_', ' ')], [s.status === 'trial' ? 'Trial ends' : 'Renews / ends', date(s.status === 'trial' ? s.trial_ends_at : s.period_ends_at)]].map(([l, v]) => (
        <div key={l} className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted">{l}</div><div className="mt-1 text-lg font-bold capitalize">{v}</div></div>))}</div>}
      <div className="flex items-center gap-2"><b className="text-sm">Choose a plan</b>
        {([1, 12] as const).map((m) => <button key={m} onClick={() => setMonths(m)} className={`h-8 rounded-lg px-3 text-xs font-medium ${months === m ? 'bg-primary text-white' : 'border border-border text-muted'}`}>{m === 1 ? 'Monthly' : 'Yearly'}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-3">{d?.plans.map((p) => (
        <div key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
          <div className="text-lg font-bold">{p.name}</div>
          <div className="mt-1 text-2xl font-bold text-primary">{p.currency} {n(months === 12 ? p.yearly_price : p.price)}<span className="text-sm font-normal text-muted"> / {months === 12 ? 'year' : 'month'}</span></div>
          <ul className="my-3 flex-1 space-y-1 text-sm text-muted"><li>{p.max_branches ?? 'Unlimited'} branches</li><li>{p.max_users ?? 'Unlimited'} users</li><li>Unlimited phones, sales and purchases</li></ul>
          <button onClick={() => choose(p)} className="h-9 rounded-lg bg-primary text-sm font-semibold text-white">{s?.plan === p.name && s.status === 'active' ? 'Renew' : 'Choose'} {p.name}</button>
        </div>))}</div>
      {open && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">You have an unpaid invoice <b>{open.invoice_no}</b> ({open.currency} {n(open.amount)}).
        <button onClick={() => setPay({ id: open.id, amount: open.amount, currency: open.currency })} className="font-semibold text-primary underline">Pay now</button></div>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-sm">
        <thead className="bg-bg/60 text-left text-xs uppercase text-muted"><tr>{['Invoice', 'Date', 'Plan', 'Period', 'Amount', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody>{d?.invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No invoices yet.</td></tr>}
          {d?.invoices.map((i) => { const st = i.status === 'pending' && i.payment_status === 'pending' ? 'pending' : i.status === 'pending' && i.payment_status === 'rejected' ? 'rejected' : i.status;
            return (<tr key={i.id} className="border-t border-border"><td className="px-4 py-2.5 font-medium">{i.invoice_no}</td><td className="px-4 py-2.5">{i.date}</td><td className="px-4 py-2.5">{i.plan}</td>
              <td className="px-4 py-2.5">{i.months === 12 ? 'Yearly' : 'Monthly'}</td><td className="px-4 py-2.5 tabular-nums">{i.currency} {n(i.amount)}</td>
              <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs ${badge[st] ?? ''}`}>{st === 'pending' && i.payment_status === 'pending' ? 'Under review' : st}</span>
                {st === 'rejected' && i.review_note && <div className="text-xs text-danger">{i.review_note}</div>}</td></tr>); })}</tbody></table></div>
      {pay && d && <PayModal pay={pay} options={d.options} onClose={() => setPay(null)} onDone={() => { setPay(null); load(); }} />}
    </div>
  );
}

function PayModal({ pay, options, onClose, onDone }: { pay: { id: number; amount: string; currency: string }; options: Data['options']; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'online' | 'manual'>(options.gateway ? 'online' : 'manual');
  const [method, setMethod] = useState(options.manual[0]?.key ?? '');
  const [err, setErr] = useState<ApiError | string | null>(null); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const chosen = options.manual.find((m) => m.key === method);
  const fe = (k: string) => (err instanceof ApiError ? err.field(k) : undefined);

  async function online() {
    setBusy(true); setErr(null);
    try { const r = await api<{ url: string }>(`/billing/invoices/${pay.id}/checkout`, { method: 'POST' }); window.location.href = r.url; }
    catch (e) { setErr(e instanceof ApiError ? e : 'Could not start the payment.'); setBusy(false); }
  }
  async function manual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api(`/billing/invoices/${pay.id}/manual-payment`, { method: 'POST', body: new FormData(e.currentTarget) }); setSent(true); }
    catch (x) { setErr(x instanceof ApiError ? x : 'Could not send the payment.'); } finally { setBusy(false); }
  }
  const ctl = 'h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5">
        <div className="flex items-center"><h2 className="text-lg font-bold">Pay {pay.currency} {n(pay.amount)}</h2><button onClick={sent ? onDone : onClose} aria-label="Close" className="ml-auto p-1 text-muted"><X size={18} /></button></div>
        {sent ? <div className="space-y-3"><p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">Thank you! We received your payment details. Your plan is activated as soon as we verify the payment (usually within a few hours).</p>
          <button onClick={onDone} className="h-9 rounded-lg bg-primary px-5 text-sm font-semibold text-white">Done</button></div> : (<>
          <div className="flex gap-2">{options.gateway && <button onClick={() => setTab('online')} className={`h-8 rounded-lg px-3 text-xs ${tab === 'online' ? 'bg-primary text-white' : 'border border-border text-muted'}`}>Pay online</button>}
            {options.manual.length > 0 && <button onClick={() => setTab('manual')} className={`h-8 rounded-lg px-3 text-xs ${tab === 'manual' ? 'bg-primary text-white' : 'border border-border text-muted'}`}>Bank / mobile wallet</button>}</div>
          {err && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{typeof err === 'string' ? err : err.message}</div>}
          {!options.gateway && options.manual.length === 0 && <p className="text-sm text-muted">No payment method is set up yet. Please contact support.</p>}
          {tab === 'online' && options.gateway && <button disabled={busy} onClick={online} className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Redirecting…' : 'Pay by card'}</button>}
          {tab === 'manual' && options.manual.length > 0 && (
            <form onSubmit={manual} className="space-y-3">
              <label className="block text-sm">Paid via<select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={ctl}>{options.manual.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
              {chosen?.details && <pre className="whitespace-pre-wrap rounded-lg bg-bg p-3 text-sm">{chosen.details}</pre>}
              <label className="block text-sm">Transaction / reference number<input name="reference" required className={ctl} /><span className="text-xs text-danger">{fe('reference')}</span></label>
              <label className="block text-sm">Receipt (photo or PDF, max 4 MB)<input name="proof" type="file" accept=".jpg,.jpeg,.png,.pdf" required className={ctl + ' py-1.5'} /><span className="text-xs text-danger">{fe('proof')}</span></label>
              <label className="block text-sm">Note (optional)<input name="note" className={ctl} /></label>
              <button disabled={busy} className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'I have paid, send for verification'}</button>
            </form>)}</>)}
      </div>
    </div>
  );
}
