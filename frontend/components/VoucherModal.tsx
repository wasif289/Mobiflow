'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, FileText, Printer, Receipt, ReceiptText, Wallet, X } from 'lucide-react';
import Combo from '@/components/Combo';
import { api, ApiError } from '@/lib/api';
import { useCan } from '@/lib/can';
import { n } from '@/lib/format';
import { useVoucher, type VoucherInit, type VoucherTab } from '@/lib/voucher';
import { cn } from '@/lib/utils';

type Party = { id: number; name: string; phone?: string | null };
type Bill = { id: number; invoice_no: string; date: string; total: string; paid: string; due: string };
type Open = { party: Party; balance: string; bills: Bill[] };              // GET /accounts/{type}/{id}/open
type Done = { tab: VoucherTab; kind: 'party' | 'expense'; id: number; no: string; amount: string; who: string };   // what we show after saving

const METHODS: [string, string][] = [['cash', 'Cash'], ['bank', 'Bank'], ['jazzcash', 'JazzCash'], ['easypaisa', 'EasyPaisa'], ['cheque', 'Cheque']];
const MONEY_RE = /^\d+(\.\d{1,2})?$/;                                       // same rule the server uses: digits, optional 1-2 decimals
const cents = (v?: string | null) => Math.round((Number(v) || 0) * 100);   // work in paisa so 0.1 + 0.2 never goes wrong
const money = (v: string) => { const [a, ...r] = v.replace(/[^\d.]/g, '').split('.'); return r.length ? `${a}.${r.join('').slice(0, 2)}` : a; };
const today = () => new Date().toISOString().slice(0, 10);
const dmy = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

/** Each tab has its own colour: red = money out, green = money in, amber = expense. */
const TAB: Record<VoucherTab, { label: string; sub: string; save: string; text: string; soft: string; solid: string }> = {
  payment: { label: 'Payment', sub: 'Pay a supplier', save: 'Save payment voucher', text: 'text-danger', soft: 'border-danger/50 bg-danger/10', solid: 'bg-danger' },
  receipt: { label: 'Receipt', sub: 'Receive from a customer', save: 'Save receipt voucher', text: 'text-success', soft: 'border-success/50 bg-success/10', solid: 'bg-success' },
  expense: { label: 'Expense', sub: 'Shop expense', save: 'Save expense voucher', text: 'text-warning', soft: 'border-warning/50 bg-warning/10', solid: 'bg-warning' },
};
const TabIcon = ({ tab, size }: { tab: VoucherTab; size: number }) => (tab === 'payment' ? <Wallet size={size} /> : tab === 'receipt' ? <Receipt size={size} /> : <ReceiptText size={size} />);

const ctl = 'h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary disabled:opacity-50';
const lbl = 'mb-1 block text-xs font-medium text-muted';

/** Supplier / customer list. Needs purchases/sales access; accountants only have the accounts list, so fall back to that. */
async function loadParties(type: 'supplier' | 'customer'): Promise<Party[]> {
  try { return await api<Party[]>(type === 'supplier' ? '/suppliers' : '/customers'); }
  catch { return (await api<{ data: Party[] }>(`/accounts/${type}?per_page=100`)).data; }
}

function Window({ init, onClose }: { init: VoucherInit; onClose: () => void }) {
  const can = useCan();
  const tabs = (['payment', 'receipt', 'expense'] as VoucherTab[]).filter((t) => (t === 'expense' ? can('expenses.create') : can('accounts.create')));
  const [tab, setTab] = useState<VoucherTab>(init.tab && tabs.includes(init.tab) ? init.tab : tabs[0]);

  // form fields
  const [partyId, setPartyId] = useState(init.partyId ? String(init.partyId) : '');
  const [billId, setBillId] = useState('');
  const [amount, setAmount] = useState(init.amount ?? '');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [headId, setHeadId] = useState('');

  // data from the server
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [heads, setHeads] = useState<Party[]>([]);
  const [info, setInfo] = useState<Open | null>(null);

  const [error, setError] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
   const [printed, setPrinted] = useState<string | null>(null);
  const [preferred] = useState<'thermal' | 'a4'>(() => { try { return localStorage.getItem('mf-slip-size') === 'a4' ? 'a4' : 'thermal'; } catch { return 'thermal'; } });   // last slip size used
  const wantBill = useRef(init.billId ? String(init.billId) : '');   // the bill we were opened for; selected once the bills have loaded

  const t = TAB[tab];
  const isPayment = tab === 'payment';

  /* 1. load the lists once (only the ones this person may use) */
  useEffect(() => {
    if (can('accounts.create')) { loadParties('supplier').then(setSuppliers).catch(() => {}); loadParties('customer').then(setCustomers).catch(() => {}); }
    if (can('expenses.create')) api<Party[]>('/expense-heads').then(setHeads).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 2. when a party is chosen: their balance and unpaid bills */
  useEffect(() => {
    if (tab === 'expense' || !partyId) return;
    let alive = true;
    api<Open>(`/accounts/${isPayment ? 'supplier' : 'customer'}/${partyId}/open`).then((r) => {
      if (!alive) return;
      setInfo(r);
      if (wantBill.current) {                                   // opened from a bill: pick it and suggest its due amount
        const b = r.bills.find((x) => String(x.id) === wantBill.current);
        wantBill.current = '';
        if (b) { setBillId(String(b.id)); setAmount((a) => a || b.due); }
      }
    }).catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [tab, partyId, isPayment]);

  /* 3. Esc closes the window (an open Combo list handles its own Esc first) */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const bill = info?.bills.find((b) => String(b.id) === billId);
  const balanceC = info ? cents(info.balance) : 0;
  const afterC = balanceC - cents(amount);                       // balance left after this voucher

  function switchTab(next: VoucherTab) {
    if (next === tab) return;
    setTab(next); setPartyId(''); setBillId(''); setInfo(null); setError(null); wantBill.current = '';
  }
  function pickParty(id: string) { setPartyId(id); setBillId(''); setInfo(null); }
  function pickBill(id: string) {
    setBillId(id);
    const b = info?.bills.find((x) => String(x.id) === id);
    if (b) setAmount(b.due);                                     // choosing a bill suggests paying it in full
  }

  /* "type it and add it": create a supplier / customer / expense head right from the field */
  const createParty = (type: 'supplier' | 'customer') => async (name: string) => {
    const p = await api<Party>(type === 'supplier' ? '/suppliers' : '/customers', { method: 'POST', body: JSON.stringify({ name }) });
    (type === 'supplier' ? setSuppliers : setCustomers)((x) => [...x, p]);
    pickParty(String(p.id));
  };
  const createHead = async (name: string) => {
    const h = await api<Party>('/expense-heads', { method: 'POST', body: JSON.stringify({ name }) });
    setHeads((x) => [...x, h]); setHeadId(String(h.id));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    // check everything here first, so the person gets a clear message instead of a server error
    if (!MONEY_RE.test(amount) || cents(amount) <= 0) return setError('Enter a valid amount, e.g. 25000 or 25000.50.');
    if (!date) return setError('Pick the date.');
    if (tab === 'expense' && !headId) return setError('Pick an expense head.');
    if (tab !== 'expense' && !partyId) return setError(isPayment ? 'Pick the supplier.' : 'Pick the customer.');
    if (bill && cents(amount) > cents(bill.due)) return setError(`That is more than the bill still owes (${n(bill.due)}). Pick “On account” to pay extra.`);

    setBusy(true);
    try {
      if (tab === 'expense') {
        const r = await api<{ id: number; voucher_no: string }>('/expenses', { method: 'POST', body: JSON.stringify({
          expense_head_id: Number(headId), amount, expense_date: date, method, notes: notes.trim() || null }) });
         setDone({ tab, kind: 'expense', id: r.id, no: r.voucher_no, amount, who: heads.find((h) => String(h.id) === headId)?.name ?? 'Expense' });
      } else {
        const r = await api<{ id: number; voucher_no: string }>('/vouchers', { method: 'POST', body: JSON.stringify({
          party_type: isPayment ? 'supplier' : 'customer', party_id: Number(partyId), direction: tab, method, amount, voucher_date: date, notes: notes.trim() || null,
          ...(bill ? (isPayment ? { purchase_id: bill.id } : { sale_id: bill.id }) : {}) }) });   // a bill is sent only when one is chosen
               setDone({ tab, kind: 'party', id: r.id, no: r.voucher_no, amount, who: (isPayment ? suppliers : customers).find((p) => String(p.id) === partyId)?.name ?? '' });
      }
    } catch (err) { setError(err instanceof ApiError ? err : 'Could not save the voucher.'); } finally { setBusy(false); }
  }
    /** Opens the print page in a new tab: it loads the slip, prints straight away and closes itself. */
  function printSlip(kind: Done['kind'], id: number, size: 'thermal' | 'a4') {
    try { localStorage.setItem('mf-slip-size', size); } catch { /* private mode: ignore */ }   // remember the choice for next time
    window.open(`/vouchers/${kind}/${id}/print?size=${size}&auto=1`, '_blank');
    setPrinted(size === 'thermal' ? 'Thermal slip sent to the print tab.' : 'A4 slip sent to the print tab.');
  }
  
  function another() { setPrinted(null); setDone(null); setAmount(''); setNotes(''); setBillId(''); setPartyId(''); setInfo(null); setHeadId(''); setError(null); }

  if (tabs.length === 0) return null;
  const partyOpts = (isPayment ? suppliers : customers).map((p) => ({ value: String(p.id), label: p.phone ? `${p.name} (${p.phone})` : p.name }));
  const canMakeParty = isPayment ? can('purchases.create') : can('sales.create');   // adding a supplier/customer needs its own right

  return (
    <div className="no-print fixed inset-0 z-[70] grid place-items-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="Voucher" onMouseDown={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <span className={cn('grid size-9 place-items-center rounded-xl text-white', t.solid)}><TabIcon tab={tab} size={18} /></span>
          <div className="flex-1"><h2 className="text-base font-bold leading-tight">Voucher</h2><p className="text-xs text-muted">Every payment, receipt and expense is recorded here</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text"><X size={18} /></button>
        </div>

        {/* tabs (hidden after saving) */}
        {!done && (
          <div className="grid gap-1.5 border-b border-border p-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }} role="tablist">
            {tabs.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
                className={cn('rounded-lg border px-2 py-2 text-center transition', tab === k ? TAB[k].soft : 'border-transparent hover:bg-bg')}>
                <div className={cn('text-sm font-semibold', tab === k && TAB[k].text)}>{TAB[k].label}</div><div className="text-[11px] text-muted">{TAB[k].sub}</div></button>))}
          </div>)}

        <div className="overflow-y-auto">
          {init.banner && !done && <div role="status" className="border-b border-success/30 bg-success/10 px-5 py-2.5 text-sm text-success">{init.banner}</div>}

          {done ? (
            /* saved */
            <div className="space-y-4 p-6 text-center">
              <span className={cn('mx-auto grid size-14 place-items-center rounded-full text-white', TAB[done.tab].solid)}><Check size={28} /></span>
              <div><div className="text-lg font-bold">Voucher saved</div>
                <div className="mt-1 text-sm text-muted">{done.no}{done.who && ` · ${done.who}`}</div>
                <div className={cn('mt-1 text-2xl font-black', TAB[done.tab].text)}>Rs. {n(done.amount)}</div></div>
               <div className="rounded-xl border border-border bg-bg p-4">
                <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold"><Printer size={16} /> Print the slip?</div>
                <div className="grid grid-cols-2 gap-2">
                  {([['thermal', 'Thermal slip', '80 mm roll'], ['a4', 'A4 page', 'Branded invoice']] as const).map(([k, title, sub]) => (
                    <button key={k} type="button" onClick={() => printSlip(done.kind, done.id, k)}
                      className={cn('rounded-xl border px-3 py-3 text-left transition hover:border-primary', preferred === k ? 'border-primary bg-primary/10' : 'border-border bg-card')}>
                      <div className="flex items-center gap-2 text-sm font-semibold"><FileText size={15} />{title}</div><div className="text-xs text-muted">{sub}</div></button>))}
                </div>
                {printed && <p role="status" className="mt-3 text-xs text-success">{printed}</p>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={another} className="h-10 flex-1 rounded-lg border border-border text-sm font-medium hover:bg-bg">New voucher</button>
                <button type="button" onClick={onClose} autoFocus className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-white">{printed ? 'Done' : 'No, skip printing'}</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5 p-5">
              {error && (
                <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  {typeof error === 'string' ? error : error.message}
                  {error instanceof ApiError && (error.field('amount') ?? error.field('purchase_id') ?? error.field('sale_id')) && (
                    <div className="mt-0.5 text-xs">{error.field('amount') ?? error.field('purchase_id') ?? error.field('sale_id')}</div>)}
                </div>)}

              {tab !== 'expense' ? (<>
                {/* who */}
                <div><span className={lbl}>{isPayment ? 'Supplier *' : 'Customer *'}</span>
                  <Combo label={isPayment ? 'Supplier' : 'Customer'} value={partyId} onChange={pickParty} options={partyOpts}
                    placeholder={isPayment ? 'Type supplier name…' : 'Type customer name…'} onCreate={canMakeParty ? createParty(isPayment ? 'supplier' : 'customer') : undefined} /></div>

                {/* what they owe / are owed */}
                {info && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-bg px-3 py-2 text-xs">
                    <span className="text-muted">{balanceC < 0 ? 'Advance' : isPayment ? 'Payable' : 'Receivable'}:</span>
                    <b className={cn('text-sm', balanceC === 0 ? 'text-muted' : t.text)}>{balanceC === 0 ? 'Settled' : `Rs. ${n(Math.abs(balanceC) / 100)}`}</b>
                    {cents(amount) > 0 && <span className="ml-auto text-muted">After this voucher: <b className="text-text">{afterC === 0 ? 'Settled' : `Rs. ${n(Math.abs(afterC) / 100)}${afterC < 0 ? ' advance' : ''}`}</b></span>}
                  </div>)}

                {/* which bill (optional) */}
                {info && (
                  <label className="block text-sm"><span className={lbl}>{isPayment ? 'Against purchase bill' : 'Against sale invoice'} <span className="font-normal">(optional)</span></span>
                    <select value={billId} onChange={(e) => pickBill(e.target.value)} className={ctl}>
                      <option value="">On account (no bill){info.bills.length === 0 ? ' — no unpaid bills' : ''}</option>
                      {info.bills.map((b) => <option key={b.id} value={b.id}>{b.invoice_no} · {dmy(b.date)} · due {n(b.due)}</option>)}
                    </select></label>)}
              </>) : (
                <div><span className={lbl}>Expense head *</span>
                  <Combo label="Expense head" value={headId} onChange={setHeadId} options={heads.map((h) => ({ value: String(h.id), label: h.name }))}
                    placeholder="Type head, e.g. Rent, Electricity…" onCreate={createHead} /></div>)}

              {/* amount */}
              <div>
                <div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-muted">Amount *</span>
                  {tab !== 'expense' && (bill
                    ? cents(amount) !== cents(bill.due) && <button type="button" onClick={() => setAmount(bill.due)} className="text-xs font-medium text-primary hover:underline">Full bill {n(bill.due)}</button>
                    : info && balanceC > 0 && cents(amount) !== balanceC && <button type="button" onClick={() => setAmount(info.balance)} className="text-xs font-medium text-primary hover:underline">Full balance {n(info.balance)}</button>)}
                </div>
                <div className="relative"><span className="pointer-events-none absolute left-3 top-3 text-sm font-semibold text-muted">Rs.</span>
                  <input inputMode="decimal" aria-label="Amount" value={amount} onChange={(e) => setAmount(money(e.target.value))} placeholder="0"
                    className={cn(ctl, 'h-12 pl-11 text-xl font-bold tabular-nums', t.text)} /></div>
              </div>

              {/* method */}
              <div><span className={lbl}>Paid by</span>
                <div className="flex flex-wrap gap-1.5">{METHODS.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={method === k} onClick={() => setMethod(k)}
                    className={cn('h-8 rounded-full border px-3.5 text-xs font-medium transition', method === k ? 'border-primary bg-primary text-white' : 'border-border hover:border-primary/60')}>{label}</button>))}</div></div>

              <div className="grid grid-cols-5 gap-3">
                <label className="col-span-2 block text-sm"><span className={lbl}>Date *</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={ctl} /></label>
                <label className="col-span-3 block text-sm"><span className={lbl}>Notes</span><input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note…" className={ctl} /></label>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-5 text-sm font-medium hover:bg-bg">Cancel</button>
                <button disabled={busy} className={cn('h-11 flex-1 rounded-lg text-sm font-semibold text-white shadow-sm disabled:opacity-60', t.solid)}>{busy ? 'Saving…' : t.save}</button>
              </div>
            </form>)}
        </div>
      </div>
    </div>
  );
}

/** Mounted once in AppShell. Open it from anywhere with useVoucher.getState().show({...}) or the F9 key. */
export default function VoucherModal() {
  const { open, nonce, init, hide } = useVoucher();
  if (!open) return null;
  return <Window key={nonce} init={init} onClose={hide} />;
}