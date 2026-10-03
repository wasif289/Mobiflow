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

export async function api<T>(path: string, init: RequestInit & { tenant?: string } = {}): Promise<T> {
  const s = useSession.getState();
  const { tenant, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...rest,
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        'X-Tenant': tenant ?? s.tenant, 'X-Request-Id': crypto.randomUUID(),
        ...(s.token && { Authorization: `Bearer ${s.token}` }),
        ...(s.branchId && { 'X-Branch-Id': String(s.branchId) }),
        ...rest.headers,
      },
    });
  } catch {
    throw new ApiError({ title: 'Cannot reach the server. Check your internet connection.', status: 0, code: 'NETWORK' });
  }
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const problem: Problem = body?.code ? body
      : { title: 'The server sent an unexpected response.', status: res.status, code: 'BAD_RESPONSE' };
    if (problem.status === 401 && s.token) s.signOut(); // expired token: guard sends user to /login
    throw new ApiError(problem);
  }
  return body as T;
}
