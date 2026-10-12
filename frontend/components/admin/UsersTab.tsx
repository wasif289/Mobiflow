'use client';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import DataTable, { type Col } from '@/components/DataTable';
import UserModal from './UserModal';

type U = { id: number; name: string; username: string; role: string; branches: string | null; active: boolean; last_login: string | null };

export default function UsersTab() {
  const [edit, setEdit] = useState<number | null | undefined>(undefined); // undefined = closed, null = new user
  const [reload, setReload] = useState(0);
  const cols: Col<U>[] = [
    { key: 'name', label: 'Name', sort: 'name', cell: (r) => <b>{r.name}</b> }, { key: 'username', label: 'Username', sort: 'username' },
    { key: 'role', label: 'Role', sort: 'role', cell: (r) => <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${r.role === 'staff' ? 'bg-muted/20 text-muted' : 'bg-primary/15 text-primary'}`}>{r.role}</span> },
    { key: 'branches', label: 'Branches', cell: (r) => r.branches ?? (r.role === 'staff' ? <span className="text-danger">None</span> : 'All') },
    { key: 'active', label: 'Status', cell: (r) => <span className={`rounded-full px-2 py-0.5 text-xs ${r.active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{r.active ? 'Active' : 'Inactive'}</span> },
    { key: 'login', label: 'Last login', sort: 'login', cell: (r) => (r.last_login ? new Date(r.last_login).toLocaleString('en-PK') : 'Never') },
    { key: 'x', label: '', align: 'right', cell: (r) => <button onClick={() => setEdit(r.id)} aria-label={`Edit ${r.name}`} className="p-1 text-muted hover:text-primary"><Pencil size={15} /></button> },
  ];
  return (
    <>
      <DataTable<U> title="Users" endpoint="/admin/users" exportName="users" rowKey={(r) => r.id} cols={cols} reload={reload} sort={{ key: 'name', dir: 'asc' }} searchHint="Search name or username…"
        filters={[{ name: 'role', label: 'All roles', options: [{ value: '', label: '' }, { value: 'owner', label: 'Owner' }, { value: 'admin', label: 'Admin' }, { value: 'staff', label: 'Staff' }] },
          { name: 'status', label: 'Any status', options: [{ value: '', label: '' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }]}
        chips={(t) => [{ label: 'Users', value: String(t.count) }, { label: 'Active', value: String(t.active), tone: 'text-success' }]}
        actions={<button onClick={() => setEdit(null)} className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><Plus size={16} /> New user</button>} />
      {edit !== undefined && <UserModal id={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); setReload((x) => x + 1); }} />}
    </>
  );
}
