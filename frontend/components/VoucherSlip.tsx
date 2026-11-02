import { amountInWords } from '@/lib/words';

export type Shop = { name: string; phone: string | null; address: string | null; footer: string | null };
export type Bill = { invoice_no: string; date: string; total: string; paid: string; due: string };

/** What the server sends for a slip: GET /vouchers/{id} (kind 'party') or GET /expenses/{id} (kind 'expense'). */
export type SlipData =
  | { kind: 'party'; voucher_no: string; direction: 'payment' | 'receipt'; date: string; party_type: 'supplier' | 'customer'; party: string | null; phone: string | null;
      method: string; amount: string; bill_ref: string | null; notes: string | null; bill: Bill | null; balance: string | null; by: string | null; branch: string | null; created_at: string }
  | { kind: 'expense'; voucher_no: string; date: string; head: string; method: string; amount: string; notes: string | null; by: string | null; branch: string | null; created_at: string };

const METHODS: Record<string, string> = { cash: 'Cash', bank: 'Bank transfer', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa', cheque: 'Cheque' };
const money = (v: string | number) => Number(v).toLocaleString('en-PK', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const dmy = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const clock = (iso: string) => { const t = new Date(iso.replace(' ', 'T')); return isNaN(t.getTime()) ? '' : t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

/** Works out the wording once, so the thermal and A4 slips always say the same thing. */
function describe(d: SlipData) {
  if (d.kind === 'expense') {
    return { title: 'Expense Voucher', accent: '#b45309', soft: '#fef3c7', stamp: 'PAID', who: 'Expense head', whoValue: d.head, phone: null as string | null,
      sign: ['Prepared by', 'Approved by', 'Received by'], balanceLabel: null as string | null };
  }
  const pay = d.direction === 'payment';
  const bal = d.balance === null ? null : Number(d.balance);
  const side = d.party_type === 'supplier' ? (bal! > 0 ? 'Payable to supplier' : 'Advance with supplier') : (bal! > 0 ? 'Receivable from customer' : 'Advance from customer');
  return {
    title: pay ? 'Payment Voucher' : 'Receipt Voucher', accent: pay ? '#b91c1c' : '#047857', soft: pay ? '#fee2e2' : '#d1fae5', stamp: pay ? 'PAID' : 'RECEIVED',
    who: pay ? 'Paid to' : 'Received from', whoValue: d.party ?? '—', phone: d.phone,
    sign: pay ? ['Prepared by', 'Authorised by', 'Received by (supplier)'] : ['Prepared by', 'Authorised by', 'Paid by (customer)'],
    balanceLabel: bal === null ? null : bal === 0 ? 'Account settled' : `${side}: Rs. ${money(Math.abs(bal))}`,
  };
}

/** The shop's first letter in a circle: a simple logo until shops can upload their own. */
function Monogram({ name, size, dark }: { name: string; size: number; dark?: boolean }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: dark ? '#000' : '#fff', color: dark ? '#fff' : '#0b2a6f', fontWeight: 800, fontSize: size * 0.5,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>{(name.trim()[0] ?? 'M').toUpperCase()}</span>
  );
}

/* ───────────────────────────── A4 page ───────────────────────────── */
function A4({ d, shop }: { d: SlipData; shop: Shop }) {
  const v = describe(d);
  const exact = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties;   // print the colours, not just black text
  const rows: [string, string | null][] = d.kind === 'party'
    ? [[v.who, v.whoValue], ['Phone', v.phone], ['Payment method', METHODS[d.method] ?? d.method], ['Reference', d.bill_ref], ['Branch', d.branch], ['Prepared by', d.by]]
    : [[v.who, v.whoValue], ['Payment method', METHODS[d.method] ?? d.method], ['Branch', d.branch], ['Prepared by', d.by]];
  return (
    <div style={{ ...exact, position: 'relative', width: '100%', maxWidth: 794, margin: '0 auto', background: '#fff', color: '#0f172a', fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      {/* faint stamp behind everything */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
        <span style={{ transform: 'rotate(-24deg)', fontSize: 120, fontWeight: 900, letterSpacing: 10, color: v.accent, opacity: 0.05 }}>{v.stamp}</span>
      </div>

      {/* brand band: shop on the left, voucher type and number on the right */}
      <div style={{ ...exact, position: 'relative', zIndex: 1, background: 'linear-gradient(115deg,#0b2a6f 0%,#1d4ed8 62%,#3b82f6 100%)', color: '#fff', padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Monogram name={shop.name} size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.15 }}>{shop.name}</div>
          <div style={{ fontSize: 12, opacity: 0.88, marginTop: 4, lineHeight: 1.5 }}>{[shop.address, shop.phone && `Tel: ${shop.phone}`].filter(Boolean).join('  •  ')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-block', background: v.accent, color: '#fff', borderRadius: 999, padding: '4px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>{v.title}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8, letterSpacing: 0.5 }}>{d.voucher_no}</div>
          <div style={{ fontSize: 12, opacity: 0.88 }}>{dmy(d.date)}{d.created_at && clock(d.created_at) ? `  ·  ${clock(d.created_at)}` : ''}</div>
        </div>
      </div>
      <div style={{ ...exact, height: 5, background: `linear-gradient(90deg,${v.accent},transparent)`, position: 'relative', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '24px 28px 20px' }}>
        {/* details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 18px', background: '#f8fafc', ...exact }}>
          {rows.filter(([, val]) => val).map(([k, val]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px dashed #cbd5e1', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{k}</span><b style={{ textAlign: 'right' }}>{val}</b>
            </div>))}
        </div>

        {/* amount in figures and words */}
        <div style={{ ...exact, marginTop: 18, display: 'flex', alignItems: 'center', gap: 18, border: `1.5px solid ${v.accent}`, background: v.soft, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: v.accent, textTransform: 'uppercase' }}>Amount</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 6, fontStyle: 'italic', lineHeight: 1.45 }}>{amountInWords(d.amount)}</div>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: v.accent, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>Rs. {money(d.amount)}</div>
        </div>

        {/* the bill this voucher settled */}
        {d.kind === 'party' && d.bill && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18, fontSize: 12.5 }}>
            <thead><tr style={{ ...exact, background: '#0b2a6f', color: '#fff' }}>
              {['Against bill', 'Bill date', 'Bill total', 'Paid so far', 'Remaining'].map((h, i) => <th key={h} style={{ padding: '8px 12px', textAlign: i > 1 ? 'right' : 'left', fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>)}</tr></thead>
            <tbody><tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '9px 12px', fontWeight: 700 }}>{d.bill.invoice_no}</td><td style={{ padding: '9px 12px' }}>{dmy(d.bill.date)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right' }}>Rs. {money(d.bill.total)}</td><td style={{ padding: '9px 12px', textAlign: 'right' }}>Rs. {money(d.bill.paid)}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: Number(d.bill.due) > 0 ? v.accent : '#047857' }}>{Number(d.bill.due) > 0 ? `Rs. ${money(d.bill.due)}` : 'Fully paid'}</td></tr></tbody>
          </table>)}

        {v.balanceLabel && <div style={{ marginTop: 14, fontSize: 13, color: '#334155' }}>Account balance after this voucher: <b>{v.balanceLabel}</b></div>}
        {d.notes && <div style={{ marginTop: 14, fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}><span style={{ color: '#64748b' }}>Notes: </span>{d.notes}</div>}

        {/* signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginTop: 56 }}>
          {v.sign.map((s) => <div key={s} style={{ borderTop: '1.5px solid #334155', paddingTop: 6, textAlign: 'center', fontSize: 11.5, color: '#475569', fontWeight: 600 }}>{s}</div>)}
        </div>
      </div>

      <div style={{ ...exact, position: 'relative', zIndex: 1, background: '#f1f5f9', borderTop: '1px solid #e2e8f0', padding: '10px 28px', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: '#64748b' }}>
        <span>{shop.footer || 'Thank you for your business.'}</span>
        <span>Generated by MobiFlow · {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── Thermal (80 mm roll, black on white) ───────────────────────────── */
function Thermal({ d, shop }: { d: SlipData; shop: Shop }) {
  const v = describe(d);
  const rule = { borderTop: '1px dashed #000', margin: '7px 0' } as const;
  const Row = ({ k, val, bold }: { k: string; val: string | null; bold?: boolean }) => !val ? null : (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '1.5px 0' }}><span>{k}</span><span style={{ fontWeight: bold ? 800 : 600, textAlign: 'right' }}>{val}</span></div>);
  return (
    <div style={{ width: '72mm', maxWidth: '100%', margin: '0 auto', background: '#fff', color: '#000', fontFamily: '"Segoe UI", Arial, sans-serif', padding: '2mm 0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <div style={{ textAlign: 'center' }}>
        <Monogram name={shop.name} size={38} dark />
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 5, lineHeight: 1.15 }}>{shop.name}</div>
        {shop.address && <div style={{ fontSize: 10.5, marginTop: 3 }}>{shop.address}</div>}
        {shop.phone && <div style={{ fontSize: 10.5 }}>Tel: {shop.phone}</div>}
      </div>
      <div style={rule} />
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: 2, padding: '4px 0', textTransform: 'uppercase' }}>{v.title}</div>
      <div style={{ marginTop: 6 }}>
        <Row k="Voucher no" val={d.voucher_no} bold />
        <Row k="Date" val={`${dmy(d.date)}${d.created_at && clock(d.created_at) ? '  ' + clock(d.created_at) : ''}`} />
        <Row k={v.who} val={v.whoValue} bold />
        <Row k="Phone" val={v.phone} />
        <Row k="Method" val={METHODS[d.method] ?? d.method} />
        {d.kind === 'party' && <Row k="Ref" val={d.bill_ref} />}
      </div>
      <div style={{ border: '2px solid #000', borderRadius: 4, textAlign: 'center', padding: '6px 4px', margin: '8px 0 4px' }}>
        <div style={{ fontSize: 9.5, letterSpacing: 2, fontWeight: 700 }}>AMOUNT</div>
        <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>Rs. {money(d.amount)}</div>
      </div>
      <div style={{ fontSize: 10, fontStyle: 'italic', textAlign: 'center', lineHeight: 1.35 }}>{amountInWords(d.amount)}</div>
      {d.kind === 'party' && d.bill && (<>
        <div style={rule} />
        <Row k="Against bill" val={d.bill.invoice_no} bold /><Row k="Bill total" val={`Rs. ${money(d.bill.total)}`} />
        <Row k="Paid so far" val={`Rs. ${money(d.bill.paid)}`} /><Row k="Remaining" val={Number(d.bill.due) > 0 ? `Rs. ${money(d.bill.due)}` : 'Fully paid'} bold />
      </>)}
      {v.balanceLabel && (<><div style={rule} /><div style={{ fontSize: 11, textAlign: 'center', fontWeight: 700 }}>{v.balanceLabel}</div></>)}
      {d.notes && <div style={{ fontSize: 10.5, marginTop: 6 }}>Note: {d.notes}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
        {[v.sign[0], v.sign[2]].map((s) => <div key={s} style={{ flex: 1, borderTop: '1px solid #000', paddingTop: 3, textAlign: 'center', fontSize: 9.5 }}>{s.replace(' (supplier)', '').replace(' (customer)', '')}</div>)}
      </div>
      <div style={rule} />
      <div style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600 }}>{shop.footer || 'Thank you for your business.'}</div>
      <div style={{ textAlign: 'center', fontSize: 8.5, marginTop: 4, letterSpacing: 0.4 }}>Printed by {d.by ?? '—'} · powered by MobiFlow</div>
    </div>
  );
}

export default function VoucherSlip({ data, shop, size }: { data: SlipData; shop: Shop; size: 'thermal' | 'a4' }) {
  return size === 'thermal' ? <Thermal d={data} shop={shop} /> : <A4 d={data} shop={shop} />;
}