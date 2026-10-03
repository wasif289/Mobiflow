'use client';
import { useSession } from '@/lib/session';

const STATS = [
  { label: 'Today’s sales', value: 'Rs 0', tone: 'text-success' },
  { label: 'Phones in stock', value: '0', tone: 'text-primary' },
  { label: 'Receivable', value: 'Rs 0', tone: 'text-warning' },
  { label: 'Payable', value: 'Rs 0', tone: 'text-danger' },
];

export default function Dashboard() {
  const { user, branchId } = useSession();
  const branch = user?.branches.find((b) => b.id === branchId);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">{branch ? branch.name : 'No branch assigned yet. Ask the owner to add you to one.'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
