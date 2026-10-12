'use client';
import Link from 'next/link';
import { useSession } from '@/lib/session';

export default function SubscriptionBanner() {
  const sub = useSession((s) => s.user?.subscription);
  const canPay = ['owner', 'admin'].includes(useSession((s) => s.user?.role) ?? '');
  if (!sub) return null;
  const d = sub.days_left;
  const msg = sub.status === 'suspended' ? 'Your account is suspended: you can view data but not make changes.'
    : sub.status === 'past_due' ? 'Your subscription has expired. Pay now to avoid suspension.'
    : sub.status === 'trial' && d !== null && d <= 7 ? `Your free trial ends in ${Math.max(d, 0)} day${d === 1 ? '' : 's'}.`
    : sub.status === 'active' && d !== null && d <= 5 ? `Your subscription renews in ${Math.max(d, 0)} day${d === 1 ? '' : 's'}.` : null;
  if (!msg) return null;
  const bad = sub.status === 'suspended' || sub.status === 'past_due';
  return (
    <div role="status" className={`no-print flex flex-wrap items-center gap-2 px-4 py-2 text-sm ${bad ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
      {msg}{canPay && <Link href="/billing" className="font-semibold underline">Go to billing</Link>}
    </div>
  );
}
