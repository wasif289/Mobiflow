'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type P = { token: string | null; admin: { name: string; email: string } | null; signIn: (t: string, a: P['admin']) => void; signOut: () => void };

/** Super-admin session, completely separate from shop sessions. */
export const usePlatform = create<P>()(persist((set) => ({
  token: null, admin: null,
  signIn: (token, admin) => set({ token, admin }),
  signOut: () => set({ token: null, admin: null }),
}), { name: 'mobiflow-platform' }));
