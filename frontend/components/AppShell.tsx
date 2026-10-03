'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Receipt, Boxes, Smartphone, Wallet, Settings, Moon, Sun, LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession, type User } from '@/lib/session';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/purchases', label: 'Purchase', icon: ShoppingCart },
  { href: '/sales', label: 'Sales', icon: Receipt },
  { href: '/catalog', label: 'Catalog', icon: Smartphone },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/admin', label: 'Admin', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { token, user, branchId, setBranch, setUser, signOut } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    if (!token) { router.replace('/login'); return; }
    api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => {}); // 401 handled in api()
  }, [ready, token, router, setUser]);

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    signOut();
  }

  if (!ready || !token || !user) return null;
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar p-3 md:block">
        <div className="mb-4 px-2 text-lg font-bold text-primary">MobiFlow</div>
        <nav className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${path.startsWith(href) ? 'bg-primary text-white' : 'text-muted hover:bg-bg'}`}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center gap-3 border-b border-border bg-sidebar px-4 py-2">
          <select aria-label="Branch" value={branchId ?? ''} onChange={(e) => setBranch(Number(e.target.value))}
            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm">
            {user.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className="ml-auto text-sm text-muted">{user.name}</span>
          <button onClick={toggleTheme} aria-label="Toggle theme" className="rounded-lg p-2 text-muted hover:bg-bg">
            <Sun size={18} className="hidden dark:block" /><Moon size={18} className="dark:hidden" />
          </button>
          <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-muted hover:bg-bg"><LogOut size={18} /></button>
        </header>
        <main key={branchId} className="p-4">{children}</main>
      </div>
    </div>
  );
}
