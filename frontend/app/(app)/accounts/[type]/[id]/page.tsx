"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Printer, Search, Wallet } from "lucide-react";
import PeriodFilter, { type Period } from "@/components/PeriodFilter";
import VoucherPrintButtons from "@/components/VoucherPrintButtons";
import { api, ApiError } from "@/lib/api";
import { useCan } from "@/lib/can";
import { rangeFor } from "@/lib/dates";
import { n } from "@/lib/format";
import { useVoucher } from "@/lib/voucher";

type Row = {
  id: number;
  date: string;
  ref: string;
  ref_id: number | null;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};
type Stmt = {
  party: { id: number; name: string };
  balance: string;
  rows: Row[];
};
const cell = (v: string) => (Number(v) === 0 ? "" : n(v));

export default function Statement() {
  const { type, id } = useParams<{
    type: "supplier" | "customer";
    id: string;
  }>();
  const [s, setS] = useState<Stmt | null>(null);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [period, setPeriod] = useState<Period>({
    preset: "all",
    ...rangeFor("all"),
  });
  const [q, setQ] = useState("");
  const can = useCan();
  const showVoucher = useVoucher((v) => v.show);

  const load = useCallback(() => {
    const u = new URLSearchParams();
    if (period.from) u.set("from", period.from);
    if (period.to) u.set("to", period.to);
    api<Stmt>(`/accounts/${type}/${id}?${u}`)
      .then(setS)
      .catch((e) => setError(e instanceof ApiError ? e : "Failed to load."));
  }, [type, id, period]);
  useEffect(load, [load]);

  const rows = useMemo(
    () =>
      (s?.rows ?? []).filter(
        (r) =>
          !q || (r.description + r.ref).toLowerCase().includes(q.toLowerCase()),
      ),
    [s, q],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({ d: a.d + Number(r.debit), c: a.c + Number(r.credit) }),
        { d: 0, c: 0 },
      ),
    [rows],
  );

  function exportCsv() {
    const lines = [
      ["Date", "Description", "Debit", "Credit", "Balance"],
      ...rows.map((r) => [
        r.date,
        `"${r.description.replace(/"/g, '""')}"`,
        r.debit,
        r.credit,
        r.balance,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + lines.map((l) => l.join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-${s?.party.name ?? id}-statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ctl =
    "h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary";
  return (
    <div className="space-y-3">
      <Link href="/accounts" className="no-print text-sm text-muted">
        ← Accounts
      </Link>
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-xl font-bold">{s?.party.name ?? "…"}</h1>
        {s && (
          <span
            className={`text-sm font-semibold ${Number(s.balance) === 0 ? "text-muted" : type === "customer" ? "text-warning" : "text-danger"}`}
          >
            {Number(s.balance) === 0
              ? "Settled"
              : `${type === "customer" ? "Receivable" : "Payable"} ${n(s.balance)}`}
          </span>
        )}
        {/* No entry form here any more: money in or out is recorded only through a voucher.
            This button opens the voucher window for this party, and the statement refreshes when the window closes. */}
        {can("accounts.create") && (
          <button
            type="button"
            onClick={() =>
              showVoucher({
                tab: type === "supplier" ? "payment" : "receipt",
                partyId: Number(id),
                onClose: load,
              })
            }
            className="no-print ml-auto flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <Wallet size={15} />{" "}
            {type === "supplier"
              ? "New payment voucher"
              : "New receipt voucher"}
          </button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          {typeof error === "string" ? error : error.message}
        </div>
      )}
      <div className="no-print space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search description…"
              className={`${ctl} w-full pl-9`}
            />
          </div>
          <button
            onClick={exportCsv}
            className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-bg"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-bg"
          >
            <Printer size={14} /> Print
          </button>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-bg/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {["Date", "Description", "Debit", "Credit", "Balance", ""].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 font-medium ${i > 1 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {s && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No entries for these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-bg/50">
                <td className="px-4 py-2.5">{r.date}</td>
                <td className="px-4 py-2.5">{r.description}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {cell(r.debit)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-success">
                  {cell(r.credit)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {n(r.balance)}
                </td>
                <td className="no-print px-2 py-2.5 text-right">
                  {r.ref === "voucher" && r.ref_id ? (
                    <VoucherPrintButtons kind="party" id={r.ref_id} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-border bg-bg/60 text-sm font-semibold">
              <tr>
                <td colSpan={2} className="px-4 py-2.5">
                  Totals ({rows.length} entries)
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {n(totals.d)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-success">
                  {n(totals.c)}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
