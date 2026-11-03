"use client";
import { create } from "zustand";

export type SlipKind = "party" | "expense"; // 'party' = supplier payment / customer receipt
export type SlipSize = "thermal" | "a4";
type Job = { kind: SlipKind; id: number; size: SlipSize; nonce: number };

type State = {
  job: Job | null; // the slip being printed right now (null = nothing)
  start: (kind: SlipKind, id: number, size: SlipSize) => void;
  finish: () => void;
};

let seq = 0; // every job gets its own number, so printing the same voucher twice still works

export const usePrintSlip = create<State>((set) => ({
  job: null,
  start: (kind, id, size) => set({ job: { kind, id, size, nonce: ++seq } }),
  finish: () => set({ job: null }),
}));

/** Prints a voucher slip right where you are, no new tab: printVoucher('party', 12, 'thermal'). PrintHost does the work. */
export function printVoucher(kind: SlipKind, id: number, size: SlipSize) {
  try {
    localStorage.setItem("mf-slip-size", size);
  } catch {
    /* private mode: ignore */
  } // remember the size for the next voucher
  usePrintSlip.getState().start(kind, id, size);
}
