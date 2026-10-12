'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Branch = { id: number; code: string; name: string; is_main: boolean };
export type User = { name: string; username: string; role: string; branches: Branch[]; permissions: string[]; subscription?: { status: string; ends_at: string | null; days_left: number | null } };

type Session = {
  token: string | null; tenant: string; user: User | null; branchId: number | null;
  signIn: (token: string, tenant: string, user: User) => void;
  setUser: (user: User) => void;
  setBranch: (id: number) => void;
  signOut: () => void;
};

export const useSession = create<Session>()(persist((set, get) => ({
  token: null, tenant: '', user: null, branchId: null,
  signIn: (token, tenant, user) => set({ token, tenant, user, branchId: user.branches[0]?.id ?? null }),
  setUser: (user) => {
    const keep = user.branches.some((b) => b.id === get().branchId);
    set({ user, branchId: keep ? get().branchId : user.branches[0]?.id ?? null });
  },
  setBranch: (branchId) => set({ branchId }),
  signOut: () => set({ token: null, user: null, branchId: null }), // keep tenant for next login
}), { name: 'mobiflow-session' }));
