import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin gateway to the Laravel API. The login token lives ONLY in an httpOnly cookie, so JavaScript
 * (and therefore any XSS) can never read it. The browser calls /api/proxy/..., this adds the Authorization header.
 */
const API = process.env.API_URL ?? 'http://localhost:8000/api/v1';
const SECURE = process.env.NODE_ENV === 'production';
const MAX_AGE = 60 * 60 * 24 * 14;
const ISSUES_TOKEN = ['auth/login', 'auth/register', 'platform/auth/login'];
const LOGOUT = ['auth/logout', 'platform/auth/logout'];
const PASS_BACK = ['content-type', 'content-disposition', 'x-trace-id'];
const PASS_ON = ['accept', 'content-type', 'x-tenant', 'x-branch-id', 'x-request-id'];

export const dynamic = 'force-dynamic';

const fail = (status: number, code: string, title: string) =>
  NextResponse.json({ type: 'about:blank', title, status, code }, { status, headers: { 'content-type': 'application/problem+json' } });

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join('/');
  const cookie = path[0] === 'platform' ? 'mf_platform' : 'mf_session';
  const writes = !['GET', 'HEAD'].includes(req.method);

  // CSRF: a cross-site form or fetch cannot add this header without CORS approval.
  if (writes && req.headers.get('x-requested-with') !== 'mobiflow') return fail(403, 'CSRF', 'Request rejected.');

  const headers = new Headers();
  for (const h of PASS_ON) { const v = req.headers.get(h); if (v) headers.set(h, v); }
  const token = req.cookies.get(cookie)?.value;
  if (token) headers.set('authorization', `Bearer ${token}`);

  let upstream: Response;
  try {
    upstream = await fetch(`${API}/${target}${req.nextUrl.search}`, {
      method: req.method, headers, body: writes ? await req.arrayBuffer() : undefined, cache: 'no-store', redirect: 'manual',
    });
  } catch {
    return fail(502, 'UPSTREAM_DOWN', 'Cannot reach the server. Please try again.');
  }

  if (ISSUES_TOKEN.includes(target) && upstream.ok) {
    const { token: issued, ...rest } = await upstream.json();
    const res = NextResponse.json(rest, { status: upstream.status });
    res.cookies.set(cookie, issued, { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: MAX_AGE });
    return res;
  }

  const back = new Headers();
  for (const h of PASS_BACK) { const v = upstream.headers.get(h); if (v) back.set(h, v); }
  const res = new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: back });
  if (LOGOUT.includes(target) || (upstream.status === 401 && target !== 'auth/login')) res.cookies.delete(cookie);
  return res;
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
