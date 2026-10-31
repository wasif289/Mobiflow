"use client";
import { useEffect, useState } from "react";
import { Wallet, X } from "lucide-react";
import { useCan } from "@/lib/can";
import { useVoucher, type VoucherInit, type VoucherTab } from "@/lib/voucher";
import { cn } from "@/lib/utils";

const TABS: Record<VoucherTab, { label: string; sub: string }> = {
  payment: { label: "Payment", sub: "Pay a supplier" },
  receipt: { label: "Receipt", sub: "Receive from a customer" },
  expense: { label: "Expense", sub: "Shop expense" },
};

function Window({ init, onClose }: { init: VoucherInit; onClose: () => void }) {
  const can = useCan();
  // payment and receipt need accounts.create, expense needs expenses.create
  const tabs = (["payment", "receipt", "expense"] as VoucherTab[]).filter(
    (t) => (t === "expense" ? can("expenses.create") : can("accounts.create")),
  );
  const [tab, setTab] = useState<VoucherTab>(
    init.tab && tabs.includes(init.tab) ? init.tab : tabs[0],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (tabs.length === 0) return null;
  return (
    <div
      className="no-print fixed inset-0 z-[70] grid place-items-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Voucher"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-white">
            <Wallet size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold leading-tight">Voucher</h2>
            <p className="text-xs text-muted">
              Every payment, receipt and expense is recorded here
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="grid gap-1.5 border-b border-border p-2"
          style={{
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))`,
          }}
          role="tablist"
        >
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg border px-2 py-2 text-center transition",
                tab === k
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:bg-bg",
              )}
            >
              <div className="text-sm font-semibold">{TABS[k].label}</div>
              <div className="text-[11px] text-muted">{TABS[k].sub}</div>
            </button>
          ))}
        </div>

        {/* the real form comes in the next step */}
        <div className="p-6 text-center text-sm text-muted">
          <b className="text-text">{TABS[tab].label}</b> form will be here.
          {init.banner && <p className="mt-2 text-success">{init.banner}</p>}
        </div>
      </div>
    </div>
  );
}

/** Mounted once in AppShell. Open it from anywhere with useVoucher.getState().show({...}) or the F9 key. */
export default function VoucherModal() {
  const { open, nonce, init, hide } = useVoucher();
  if (!open) return null;
  return <Window key={nonce} init={init} onClose={hide} />;
}
