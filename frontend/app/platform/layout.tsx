'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform';

const NAV = [['/platform', 'Overview'], ['/platform/tenants', 'Shops'], ['/platform/payments', 'Payments'], ['/platform/plans', 'Plans & settings']] as const;

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const { token, admin, signOut } = usePlatform();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => { if (ready && !token && path !== '/platform/login') router.replace('/platform/login'); }, [ready, token, path, router]);
  if (!ready) return null;
  if (path === '/platform/login') return <>{children}</>;
  if (!token) return null;
  return (
    <div className="min-h-screen">
      <header className="no-print flex flex-wrap items-center gap-1 border-b border-border bg-sidebar px-4 py-2">
        <b className="mr-4 text-primary">MobiFlow Platform</b>
        {NAV.map(([h, l]) => <Link key={h} href={h} className={`rounded-lg px-3 py-1.5 text-sm ${path === h ? 'bg-primary text-white' : 'text-muted hover:bg-bg'}`}>{l}</Link>)}
        <span className="ml-auto text-sm text-muted">{admin?.email}</span>
        <button onClick={() => { signOut(); router.replace('/platform/login'); }} className="rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10">Sign out</button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
