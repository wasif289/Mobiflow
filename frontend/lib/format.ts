export const n = (v?: string | number | null) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-PK'));
