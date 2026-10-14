'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftRight, Banknote, Boxes, Building2, CreditCard, LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus, Receipt, Search, Settings, ShoppingCart, Smartphone, Sun, Wallet, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useCan } from '@/lib/can';
import { useSession, type User } from '@/lib/session';
import { cn } from '@/lib/utils';
import CommandPalette, { type PaletteItem } from './CommandPalette';
import SubscriptionBanner from './SubscriptionBanner';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Select } from './ui/select';

type Nav = { href: string; perm: string; label: string; icon: LucideIcon };
const GROUPS: { label: string; items: Nav[] }[] = [
  { label: 'Operations', items: [
    { href: '/dashboard', perm: 'dashboard.view', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sales', perm: 'sales.view', label: 'Sales', icon: Receipt },
    { href: '/purchases', perm: 'purchases.view', label: 'Purchases', icon: ShoppingCart },
    { href: '/inventory', perm: 'inventory.view', label: 'Inventory', icon: Boxes },
    { href: '/transfers', perm: 'transfers.view', label: 'Transfers', icon: ArrowLeftRight },
    { href: '/catalog', perm: 'catalog.manage', label: 'Catalog', icon: Smartphone }] },
  { label: 'Money', items: [
    { href: '/accounts', perm: 'accounts.view', label: 'Accounts', icon: Wallet },
    { href: '/expenses', perm: 'expenses.view', label: 'Expenses', icon: Banknote }] },
  { label: 'Manage', items: [
    { href: '/billing', perm: 'admin', label: 'Billing', icon: CreditCard },
    { href: '/admin', perm: 'admin', label: 'Admin', icon: Settings }] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const can = useCan();
  const { token, user, branchId, setBranch, setUser, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => { setReady(true); try { setCollapsed(localStorage.getItem('mf-sidebar') === '1'); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (!ready) return;
    if (!token) { router.replace('/login'); return; }
    api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => {}); // 401 handled in api()
  }, [ready, token, router, setUser]);
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((o) => !o); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleTheme = () => { const dark = document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', dark ? 'dark' : 'light'); };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); signOut(); };
  const flipSidebar = () => { setCollapsed((c) => { try { localStorage.setItem('mf-sidebar', c ? '0' : '1'); } catch { /* ignore */ } return !c; }); };

  const items = useMemo<PaletteItem[]>(() => [
    ...GROUPS.flatMap((g) => g.items.filter((n) => can(n.perm)).map((n) => ({ id: n.href, label: n.label, icon: n.icon, group: 'Go to', run: () => router.push(n.href) }))),
    ...([['/sales/new', 'New sale', 'sales.create'], ['/purchases/new', 'New purchase', 'purchases.create'], ['/transfers/new', 'New transfer', 'transfers.create']] as const)
      .filter(([, , perm]) => can(perm)).map(([href, label]) => ({ id: href, label, icon: Plus, group: 'Create', run: () => router.push(href) })),
    { id: 'theme', label: 'Switch light / dark theme', icon: Moon, group: 'Preferences', run: toggleTheme },
    { id: 'logout', label: 'Sign out', icon: LogOut, group: 'Preferences', run: logout },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [user, router]);

  if (!ready || !token || !user) return null;
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const NavList = ({ narrow }: { narrow: boolean }) => (
    <nav className="space-y-5">
      {GROUPS.map((g) => { const visible = g.items.filter((n) => can(n.perm)); return visible.length === 0 ? null : (
        <div key={g.label}>
          {!narrow && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{g.label}</div>}
          <div className="space-y-0.5">{visible.map(({ href, label, icon: Icon }) => { const on = path.startsWith(href); return (
            <Link key={href} href={href} title={narrow ? label : undefined} aria-current={on ? 'page' : undefined}
              className={cn('group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', narrow && 'justify-center px-0',
                on ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-bg hover:text-text')}>
              <Icon className="size-[18px] shrink-0" />{!narrow && label}</Link>); })}</div>
        </div>); })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar p-3 transition-[width] duration-200 md:flex', collapsed ? 'w-[68px]' : 'w-64')}>
        <Link href="/dashboard" className={cn('mb-5 flex items-center gap-2 px-2', collapsed && 'justify-center px-0')}>
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-indigo-500 text-sm font-bold text-white shadow-sm">M</span>
          {!collapsed && <span className="text-lg font-bold tracking-tight">MobiFlow</span>}
        </Link>
        <div className="flex-1 overflow-y-auto"><NavList narrow={collapsed} /></div>
        <button onClick={flipSidebar} className="mt-2 flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted transition hover:bg-bg hover:text-text" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" />Collapse</>}</button>
      </aside>

      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent hideClose className="left-0 top-0 h-full max-h-none w-72 max-w-none translate-x-0 translate-y-0 rounded-none rounded-r-xl p-3">
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <div className="mb-5 flex items-center gap-2 px-2"><span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-indigo-500 text-sm font-bold text-white">M</span><span className="text-lg font-bold">MobiFlow</span></div>
          <NavList narrow={false} />
        </DialogContent>
      </Dialog>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-sidebar/80 px-3 py-2 backdrop-blur md:px-4">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu /></Button>
          <button onClick={() => setPalette(true)} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm text-muted transition hover:border-primary/50 sm:max-w-sm sm:flex-none sm:basis-80">
            <Search className="size-4 shrink-0" /><span className="truncate">Search or jump to…</span><kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] leading-5 sm:block">Ctrl K</kbd></button>
          <div className="ml-auto flex items-center gap-1.5">
            {user.branches.length > 0 && (
              <div className="relative hidden sm:block"><Building2 className="pointer-events-none absolute left-2.5 top-2.5 z-10 size-4 text-muted" />
                <Select aria-label="Branch" value={branchId ?? ''} onChange={(e) => setBranch(Number(e.target.value))} className="w-44 [&_select]:pl-8">{user.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>)}
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme}><Sun className="hidden dark:block" /><Moon className="dark:hidden" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button aria-label="Account menu" className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-xs font-bold text-white shadow-sm outline-none ring-offset-2 ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-primary">{initials}</button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel><div className="text-sm text-text">{user.name}</div><div className="font-normal capitalize">{user.role}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.branches.length > 0 && <div className="px-2 py-1.5 sm:hidden"><Select aria-label="Branch" value={branchId ?? ''} onChange={(e) => setBranch(Number(e.target.value))}>{user.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>}
                <DropdownMenuItem onSelect={toggleTheme}><Sun className="hidden dark:block" /><Moon className="dark:hidden" />Switch theme</DropdownMenuItem>
                <DropdownMenuItem onSelect={logout} className="text-danger"><LogOut />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <SubscriptionBanner />
        <main key={branchId} className="mx-auto max-w-[1600px] p-3 md:p-5">{children}</main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} items={items} />
    </div>
  );
}
