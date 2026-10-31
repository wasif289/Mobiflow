"use client";
import { create } from "zustand";

export type VoucherTab = "payment" | "receipt" | "expense";

/** What the voucher window opens with. Everything is optional. */
export type VoucherInit = {
  tab?: VoucherTab; // which tab to open on
  partyId?: number; // supplier (payment) or customer (receipt)
  billId?: number; // purchase (payment) or sale (receipt) this voucher settles
  amount?: string; // suggested amount, e.g. the bill's due
  banner?: string; // one line on top, e.g. "Purchase PI-MAIN-00012 saved."
  onClose?: () => void; // runs when the window closes
};

type State = {
  open: boolean;
  nonce: number; // changes on every open, so the form starts fresh each time
  init: VoucherInit;
  show: (init?: VoucherInit) => void;
  hide: () => void;
};

export const useVoucher = create<State>((set, get) => ({
  open: false,
  nonce: 0,
  init: {},
  show: (init = {}) => set((s) => ({ open: true, nonce: s.nonce + 1, init })),
  hide: () => {
    const cb = get().init.onClose;
    set({ open: false, init: {} });
    cb?.();
  },
}));
