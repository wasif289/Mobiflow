"use client";
import { useEffect, useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import DataTable, { type Col } from "@/components/DataTable";
import VoucherPrintButtons from "@/components/VoucherPrintButtons";
import { api, ApiError } from "@/lib/api";
import { useCan } from "@/lib/can";
import { n } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useVoucher } from "@/lib/voucher";

type E = {
  id: number;
  date: string;
  voucher_no: string | null;
  head: string;
  notes: string | null;
  amount: string;
  by: string;
};
type Head = { id: number; name: string };

export default function Expenses() {
  const admin = ["owner", "admin"].includes(
    useSession((s) => s.user?.role) ?? "",
  );
  const can = useCan();
  const showVoucher = useVoucher((v) => v.show);
  const [heads, setHeads] = useState<Head[]>([]);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Head[]>("/expense-heads")
      .then(setHeads)
      .catch(() => {});
  }, []); // only used for the "All heads" filter

  async function remove(r: E) {
    if (!confirm(`Delete ${n(r.amount)} (${r.head})?`)) return;
    try {
      await api(`/expenses/${r.id}`, { method: "DELETE" });
      setReload((x) => x + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
    }
  }

  const cols: Col<E>[] = [
    { key: "date", label: "Date", sort: "date" },
    { key: "voucher_no", label: "Voucher", cell: (r) => r.voucher_no ?? "—" },
    { key: "head", label: "Head", sort: "head" },
    { key: "notes", label: "Notes", cell: (r) => r.notes ?? "—" },
    {
      key: "amount",
      label: "Amount",
      sort: "amount",
      align: "right",
      cell: (r) => <b className="text-danger">{n(r.amount)}</b>,
    },
    { key: "by", label: "By" },
    {
      key: "print",
      label: "",
      align: "right" as const,
      cell: (r: E) => <VoucherPrintButtons kind="expense" id={r.id} />,
    },
    ...(admin
      ? [
          {
            key: "x",
            label: "",
            align: "right" as const,
            cell: (r: E) => (
              <button
                onClick={() => remove(r)}
                aria-label="Delete expense"
                className="p-1 text-muted hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-4">
      {/* An expense is entered only through a voucher. This opens the voucher window on its Expense tab
          (head, amount, method, date, notes all live there), and the list refreshes when the window closes. */}
      {can("expenses.create") && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
          <p className="text-sm text-muted">
            Every expense is recorded with its own voucher, which you can print.
          </p>
          <button
            type="button"
            onClick={() =>
              showVoucher({
                tab: "expense",
                onClose: () => setReload((x) => x + 1),
              })
            }
            className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <Wallet size={15} /> New expense voucher
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}
      <DataTable<E>
        title="Expenses"
        endpoint="/expenses"
        exportName="expenses"
        rowKey={(r) => r.id}
        cols={cols}
        dates
        defaultPeriod="month"
        reload={reload}
        sort={{ key: "date", dir: "desc" }}
        searchHint="Search head or notes…"
        filters={[
          {
            name: "head_id",
            label: "All heads",
            options: [
              { value: "", label: "" },
              ...heads.map((h) => ({ value: String(h.id), label: h.name })),
            ],
          },
        ]}
        chips={(t) => [
          { label: "Entries", value: String(t.count) },
          { label: "Total", value: n(t.total), tone: "text-danger" },
        ]}
      />
    </div>
  );
}
