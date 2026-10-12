const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'],
  ['lastmonth', 'Last month'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']] as const;

export function rangeFor(preset: string): { from: string; to: string } {
  const t = new Date();
  const day = (d: Date, add: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + add);
  switch (preset) {
    case 'today': return { from: iso(t), to: iso(t) };
    case 'yesterday': return { from: iso(day(t, -1)), to: iso(day(t, -1)) };
    case 'week': return { from: iso(day(t, -((t.getDay() + 6) % 7))), to: iso(t) }; // Monday start
    case 'month': return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
    case 'lastmonth': return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
    case 'year': return { from: iso(new Date(t.getFullYear(), 0, 1)), to: iso(t) };
    default: return { from: '', to: '' };
  }
}
