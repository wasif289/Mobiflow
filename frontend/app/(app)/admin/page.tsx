'use client';
import { useState } from 'react';
import BranchesTab from '@/components/admin/BranchesTab';
import SettingsTab from '@/components/admin/SettingsTab';
import UsersTab from '@/components/admin/UsersTab';
import { useCan } from '@/lib/can';

const TABS = [['users', 'Users & permissions'], ['branches', 'Branches'], ['settings', 'Shop & plan']] as const;

export default function Admin() {
  const can = useCan();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('users');
  if (!can('admin')) return <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted">Only the owner or an admin can open this page.</p>;
  return (
    <div className="space-y-4">
      <div role="tablist" className="no-print flex flex-wrap gap-1 border-b border-border">{TABS.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm ${tab === k ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-text'}`}>{l}</button>))}</div>
      {tab === 'users' && <UsersTab />}{tab === 'branches' && <BranchesTab />}{tab === 'settings' && <SettingsTab />}
    </div>
  );
}
