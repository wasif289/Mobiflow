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

/** Same-origin gateway (app/api/proxy). The login token is an httpOnly cookie that only the gateway can read. */
const BASE = '/api/proxy';
const network = () => new ApiError({ title: 'Cannot reach the server. Check your internet connection.', status: 0, code: 'NETWORK' });

function headers(path: string, tenant?: string): Record<string, string> {
  const base = { Accept: 'application/json', 'X-Requested-With': 'mobiflow', 'X-Request-Id': crypto.randomUUID() };
  if (path.startsWith('/platform')) return base;
  const s = useSession.getState();
  return { ...base, 'X-Tenant': tenant ?? s.tenant, ...(s.branchId && { 'X-Branch-Id': String(s.branchId) }) };
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
      else if (useSession.getState().token && path !== '/auth/login') useSession.getState().signOut(); // session expired: guards send to /login
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

/** Download a file (e.g. CSV export). */
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
