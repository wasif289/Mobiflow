import { usePlatform } from './platform';
import { useSession } from './session';

export type Problem = {
  title: string; status: number; code: string;
  errors?: Record<string, string[]>; trace_id?: string;
};

export class ApiError extends Error {
  constructor(public problem: Problem) { super(problem.title); }
  field(name: string) { return this.problem.errors?.[name]?.[0]; }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const network = () => new ApiError({ title: 'Cannot reach the server. Check your internet connection.', status: 0, code: 'NETWORK' });

/** /platform/* calls use the super-admin token; everything else uses the shop session + branch. */
function headers(path: string, tenant?: string): Record<string, string> {
  const base = { Accept: 'application/json', 'X-Request-Id': crypto.randomUUID() };
  if (path.startsWith('/platform')) {
    const t = usePlatform.getState().token;
    return { ...base, ...(t && { Authorization: `Bearer ${t}` }) };
  }
  const s = useSession.getState();
  return { ...base, 'X-Tenant': tenant ?? s.tenant, ...(s.token && { Authorization: `Bearer ${s.token}` }), ...(s.branchId && { 'X-Branch-Id': String(s.branchId) }) };
}

export async function api<T>(path: string, init: RequestInit & { tenant?: string } = {}): Promise<T> {
  const { tenant, ...rest } = init;
  const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...rest, headers: { ...headers(path, tenant), ...(!isForm && { 'Content-Type': 'application/json' }), ...rest.headers } });
  } catch { throw network(); }
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const problem: Problem = body?.code ? body : { title: 'The server sent an unexpected response.', status: res.status, code: 'BAD_RESPONSE' };
    if (problem.status === 401) {
      if (path.startsWith('/platform')) { if (usePlatform.getState().token) usePlatform.getState().signOut(); }
      else if (useSession.getState().token && path !== '/auth/login') useSession.getState().signOut(); // expired token: guards send to /login
    }
    throw new ApiError(problem);
  }
  return body as T;
}

async function blob(path: string): Promise<Blob> {
  const res = await fetch(BASE + path, { headers: headers(path) }).catch(() => { throw network(); });
  if (!res.ok) throw new ApiError({ title: res.status === 404 ? 'File not found.' : 'Download failed. Please try again.', status: res.status, code: 'DOWNLOAD_FAILED' });
  return res.blob();
}

/** Download a file (e.g. CSV export) with the same auth headers as normal calls. */
export async function download(path: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(await blob(path));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Open an authenticated file (e.g. a payment receipt) in a new tab. */
export async function openFile(path: string): Promise<void> {
  const url = URL.createObjectURL(await blob(path));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
