'use client';
import { useSession } from './session';

/** UI hint only. The server enforces every permission on every request. */
export function useCan() {
  const perms = useSession((s) => s.user?.permissions);
  const loggedIn = useSession((s) => !!s.user);
  return (p: string) => loggedIn && (!perms ? false : perms.includes('*') || perms.includes(p) ||
    (p.endsWith('.view') && perms.some((x) => x.startsWith(p.slice(0, -4)))));
}
