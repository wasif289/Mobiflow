'use client';
<<<<<<< HEAD
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, Banknote, Boxes, HandCoins, Plus, Receipt, ShoppingCart, Smartphone, TrendingUp, Truck, Wallet, type LucideIcon } from 'lucide-react';
import PeriodFilter, { type Period } from '@/components/PeriodFilter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useCan } from '@/lib/can';
import { rangeFor } from '@/lib/dates';
import { n } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

type D = { sales: string; qty_sold: number; purchases: string; expenses: string; in_stock: number; receivable: string; payable: string; profit?: string; net_profit?: string;
  recent: { id: number; invoice_no: string; date: string; customer: string; total: string }[]; trend: { date: string; sales: string; profit?: string }[] };

function Stat({ label, value, icon: Icon, tone, loading }: { label: string; value: string; icon: LucideIcon; tone: string; loading: boolean }) {
  return (
    <Card className="group relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={cn('absolute -right-6 -top-6 size-24 rounded-full opacity-10 transition group-hover:opacity-20', tone.replace('text-', 'bg-'))} />
      <div className="flex items-center gap-2 text-sm text-muted"><span className={cn('grid size-8 place-items-center rounded-lg bg-current/10', tone)}><Icon className="size-4" /></span>{label}</div>
      {loading ? <Skeleton className="mt-3 h-7 w-28" /> : <div className={cn('mt-2 text-2xl font-bold tabular-nums tracking-tight', tone)}>{value}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, branchId } = useSession();
  const can = useCan();
  const [period, setPeriod] = useState<Period>({ preset: 'month', ...rangeFor('month') });
  const [d, setD] = useState<D | null>(null); const [error, setError] = useState(false);
  const branch = user?.branches.find((b) => b.id === branchId);
  useEffect(() => {
    setError(false); setD(null);
    const u = new URLSearchParams(); if (period.from) u.set('from', period.from); if (period.to) u.set('to', period.to);
    api<D>(`/dashboard?${u}`).then(setD).catch(() => setError(true));
  }, [period, branchId]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const loading = !d && !error;
  const rs = (v?: string) => (v === undefined ? '—' : 'Rs ' + n(v));
  const chart = useMemo(() => (d?.trend ?? []).map((t) => ({ label: new Date(t.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }), sales: Number(t.sales), profit: t.profit === undefined ? undefined : Number(t.profit) })), [d]);
  const stats: { label: string; value: string; icon: LucideIcon; tone: string }[] = [
    { label: 'Sales', value: rs(d?.sales), icon: Receipt, tone: 'text-primary' },
    { label: 'Phones sold', value: String(d?.qty_sold ?? 0), icon: Smartphone, tone: 'text-primary' },
    ...(d?.profit !== undefined ? [{ label: 'Profit', value: rs(d.profit), icon: TrendingUp, tone: 'text-success' }] : []),
    { label: 'Purchases', value: rs(d?.purchases), icon: ShoppingCart, tone: 'text-warning' },
    { label: 'Expenses', value: rs(d?.expenses), icon: Banknote, tone: 'text-danger' },
    ...(d?.net_profit !== undefined ? [{ label: 'Net profit', value: rs(d.net_profit), icon: Wallet, tone: Number(d.net_profit) < 0 ? 'text-danger' : 'text-success' }] : []),
    { label: 'In stock', value: String(d?.in_stock ?? 0), icon: Boxes, tone: 'text-primary' },
    { label: 'Receivable', value: rs(d?.receivable), icon: HandCoins, tone: 'text-warning' },
    { label: 'Payable', value: rs(d?.payable), icon: Truck, tone: 'text-danger' },
  ];
  const quick = ([['/sales/new', 'New sale', 'sales.create'], ['/purchases/new', 'New purchase', 'purchases.create'], ['/transfers/new', 'New transfer', 'transfers.create']] as const).filter(([, , p]) => can(p));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">{greeting}, {user?.name.split(' ')[0]} 👋</h1>
          <p className="text-sm text-muted">{branch ? `${branch.name} · ` : ''}{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div className="ml-auto flex gap-2">{quick.map(([href, label], i) => <Button key={href} variant={i === 0 ? 'default' : 'outline'} onClick={() => router.push(href)}><Plus />{label}</Button>)}</div>
      </div>
      <Card className="p-3"><PeriodFilter value={period} onChange={setPeriod} /></Card>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Could not load the dashboard. Try again.</div>}
      <div className={cn('grid gap-3 sm:grid-cols-2', stats.length % 3 === 0 ? 'xl:grid-cols-3' : 'xl:grid-cols-4')}>{stats.map((s) => <Stat key={s.label} {...s} loading={loading} />)}</div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Sales trend</CardTitle>{d?.profit !== undefined && <span className="ml-auto flex items-center gap-3 text-xs text-muted"><i className="inline-block size-2 rounded-full bg-primary" />Sales<i className="inline-block size-2 rounded-full bg-success" />Profit</span>}</CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : chart.length === 0 ? <div className="grid h-64 place-items-center text-sm text-muted">No sales in this period yet.</div> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => 'Rs ' + n(String(v))} />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke="var(--primary)" strokeWidth={2} fill="url(#gs)" />
                  {d?.profit !== undefined && <Area type="monotone" dataKey="profit" name="Profit" stroke="var(--success)" strokeWidth={2} fill="none" />}
                </AreaChart>
              </ResponsiveContainer>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent sales</CardTitle><Link href="/sales" className="ml-auto flex items-center gap-0.5 text-xs text-primary">View all<ArrowUpRight className="size-3" /></Link></CardHeader>
          {loading ? <CardContent className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</CardContent>
            : d?.recent.length === 0 ? <CardContent className="py-10 text-center text-sm text-muted">No sales yet.</CardContent>
            : d?.recent.map((s) => (
              <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm transition last:border-0 hover:bg-bg">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Receipt className="size-4" /></span>
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{s.customer}</div><div className="text-xs text-muted">{s.invoice_no} · {s.date}</div></div>
                <b className="tabular-nums">{n(s.total)}</b></Link>))}
        </Card>
=======
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PeriodFilter, { type Period } from '@/components/PeriodFilter';
import { api } from '@/lib/api';
import { rangeFor } from '@/lib/dates';
import { n } from '@/lib/format';
import { useSession } from '@/lib/session';

type D = { sales: string; qty_sold: number; purchases: string; expenses: string; in_stock: number; receivable: string; payable: string;
  profit?: string; net_profit?: string; recent: { id: number; invoice_no: string; date: string; customer: string; total: string }[] };

export default function Dashboard() {
  const { user, branchId } = useSession();
  const [period, setPeriod] = useState<Period>({ preset: 'today', ...rangeFor('today') });
  const [d, setD] = useState<D | null>(null); const [error, setError] = useState(false);
  const branch = user?.branches.find((b) => b.id === branchId);
  useEffect(() => {
    setError(false);
    const u = new URLSearchParams(); if (period.from) u.set('from', period.from); if (period.to) u.set('to', period.to);
    api<D>(`/dashboard?${u}`).then(setD).catch(() => setError(true));
  }, [period, branchId]);
  const rs = (v?: string) => (d && v !== undefined ? 'Rs ' + n(v) : '…');
  const cards = [
    { label: 'Sales', value: rs(d?.sales), tone: 'text-success' }, { label: 'Phones sold', value: d ? String(d.qty_sold) : '…', tone: 'text-primary' },
    ...(d?.profit !== undefined ? [{ label: 'Profit', value: rs(d.profit), tone: 'text-success' }] : []),
    { label: 'Purchases', value: rs(d?.purchases), tone: 'text-text' }, { label: 'Expenses', value: rs(d?.expenses), tone: 'text-danger' },
    ...(d?.net_profit !== undefined ? [{ label: 'Net profit', value: rs(d.net_profit), tone: Number(d.net_profit) < 0 ? 'text-danger' : 'text-success' }] : []),
    { label: 'Phones in stock', value: d ? String(d.in_stock) : '…', tone: 'text-primary' },
    { label: 'Receivable', value: rs(d?.receivable), tone: 'text-warning' }, { label: 'Payable', value: rs(d?.payable), tone: 'text-danger' },
  ];
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold">Dashboard</h1><p className="text-sm text-muted">{branch ? branch.name : 'No branch assigned yet. Ask the owner to add you to one.'}</p></div>
      <div className="rounded-xl border border-border bg-card p-3"><PeriodFilter value={period} onChange={setPeriod} /></div>
      {error && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Could not load the dashboard. Try again.</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted">{c.label}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</div></div>))}</div>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center border-b border-border px-4 py-2.5"><b className="text-sm">Recent sales</b><Link href="/sales" className="ml-auto text-xs text-primary">View all</Link></div>
        {d?.recent.length === 0 && <p className="p-4 text-sm text-muted">No sales yet.</p>}
        {d?.recent.map((s) => (
          <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-bg">
            <span className="font-medium text-primary">{s.invoice_no}</span><span className="text-muted">{s.date}</span><span className="flex-1">{s.customer}</span><b className="tabular-nums">{n(s.total)}</b></Link>))}
>>>>>>> 5737d4ae512e152ecdddc237fb709be49f953281
      </div>
    </div>
  );
}
