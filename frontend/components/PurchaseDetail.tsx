"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  FileDown,
  Printer,
  Search,
  Table2,
  Undo2,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useCan } from "@/lib/can";
import { n } from "@/lib/format";

type Item = {
  imei: string;
  status: string;
  model: string;
  brand: string;
  model_name: string;
  variant: string | null;
  color: string | null;
  cost?: string;
};
type Doc = {
  id: number;
  invoice_no: string;
  purchase_date: string;
  supplier: string | null;
  created_by: string | null;
  note: string | null;
  total: string;
  paid: string;
  due: string;
  items: Item[];
};

const STATUS: Record<string, { label: string; cls: string }> = {
  in_stock: { label: "In stock", cls: "bg-success/15 text-success" },
  in_transit: { label: "In transit", cls: "bg-warning/15 text-warning" },
  sold: { label: "Sold", cls: "bg-warning/15 text-warning" },
  returned_to_supplier: { label: "Returned", cls: "bg-danger/15 text-danger" },
};
const REASONS = [
  "Defective / Kharab nikla",
  "Wrong model deliver hua",
  "Customer ne refuse kiya",
  "Supplier agreement",
  "Duplicate IMEI",
];
const dmy = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const today = () => new Date().toISOString().slice(0, 10);

const ctl =
  "h-9 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary";
const tool =
  "flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-medium hover:opacity-80";

/** Wraps the matching part of `text` in <mark>. */
function Hit({ text, q }: { text: string | null | undefined; q: string }) {
  const t = text ?? "";
  const i = q ? t.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{t}</>;
  return (
    <>
      {t.slice(0, i)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 text-yellow-900">
        {t.slice(i, i + q.length)}
      </mark>
      {t.slice(i + q.length)}
    </>
  );
}

function Err({ e }: { e: ApiError | string }) {
  const imei = e instanceof ApiError ? e.problem.errors?.imei : undefined;
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
    >
      {typeof e === "string" ? e : e.message}
      {imei && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {imei.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PurchaseDetail({ id }: { id: string }) {
  const can = useCan();
  const canReturn = can("returns.create");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<string[] | null>(null); // IMEIs being returned
  const [reason, setReason] = useState("");
  const [rdate, setRdate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [mErr, setMErr] = useState<ApiError | string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api<Doc>(`/purchases/${id}`)
      .then(setDoc)
      .catch((e) => setError(e instanceof ApiError ? e : "Failed to load."));
  }, [id]);
  useEffect(load, [load]);

  // /purchases/{id}?print=1 (Save & print) opens the print dialog once the bill has loaded
  useEffect(() => {
    if (doc && new URLSearchParams(window.location.search).get("print") === "1")
      setTimeout(() => window.print(), 300);
  }, [doc]);

  const hasCost = !!doc?.items.some((i) => i.cost !== undefined);
  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (doc?.items ?? [])
        .map((it, idx) => ({ it, no: idx + 1 }))
        .filter(
          ({ it }) =>
            !needle ||
            [
              it.imei,
              it.model,
              it.brand,
              it.model_name,
              it.variant,
              it.color,
            ].some((v) => (v ?? "").toLowerCase().includes(needle)),
        ),
    [doc, needle],
  );
  const returnable = useMemo(
    () => (doc?.items ?? []).filter((i) => i.status === "in_stock"),
    [doc],
  );
  const allPicked =
    returnable.length > 0 && returnable.every((i) => picked.has(i.imei));
  const toggle = (imei: string) =>
    setPicked((p) => {
      const s = new Set(p);
      if (s.has(imei)) s.delete(imei);
      else s.add(imei);
      return s;
    });
  const costOf = (imeis: string[]) =>
    (doc?.items ?? [])
      .filter((i) => imeis.includes(i.imei))
      .reduce((s, i) => s + (Number(i.cost) || 0), 0);

  function openReturn(imeis: string[]) {
    if (imeis.length === 0) return;
    setReason("");
    setRdate(today());
    setMErr(null);
    setModal(imeis);
  }
  async function submitReturn() {
    if (!modal) return;
    setBusy(true);
    setMErr(null);
    try {
      const r = await api<{ return_no: string; total: string }>(
        `/purchases/${id}/returns`,
        {
          method: "POST",
          body: JSON.stringify({
            imeis: modal,
            reason: reason.trim(),
            return_date: rdate,
          }),
        },
      );
      setModal(null);
      setPicked(new Set());
      setDone(`Return ${r.return_no} saved (Rs. ${n(r.total)}).`);
      load();
    } catch (e) {
      setMErr(e instanceof ApiError ? e : "Could not save the return.");
    } finally {
      setBusy(false);
    }
  }

  /* ── exports (what is visible in the table) ── */
  const exportRows = () =>
    rows.map(({ it, no }) => [
      no,
      it.imei,
      it.model,
      it.brand,
      it.model_name,
      it.variant ?? "",
      it.color ?? "",
      ...(hasCost ? [it.cost ?? ""] : []),
      STATUS[it.status]?.label ?? it.status,
    ]);
  const head = [
    "#",
    "IMEI",
    "Mobile",
    "Brand",
    "Model",
    "Variant",
    "Color",
    ...(hasCost ? ["Cost price"] : []),
    "Status",
  ];
  function exportCSV() {
    if (!doc) return;
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["Purchase", doc.invoice_no],
      ["Supplier", doc.supplier ?? ""],
      ["Date", dmy(doc.purchase_date)],
      ["Created by", doc.created_by ?? ""],
      ["Total", doc.total],
      ["Paid", doc.paid],
      ["Due", doc.due],
      [],
      head,
      ...exportRows(),
    ].map((r) => r.map(cell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    a.download = `Purchase_${doc.invoice_no}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function copyTable() {
    try {
      await navigator.clipboard.writeText(
        [head, ...exportRows()].map((r) => r.join("\t")).join("\n"),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy is blocked by the browser (needs https).");
    }
  }

  const stat = (label: string, value: React.ReactNode, cls = "") => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );

  return (
    <div id="print-area" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/purchases"
          aria-label="Back to purchases"
          className="no-print rounded-lg p-2 text-muted hover:bg-bg"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            Purchase:{" "}
            <span className="text-primary">{doc?.invoice_no ?? "…"}</span>
          </h1>
          {doc && (
            <p className="text-xs text-muted">
              {doc.supplier ?? "—"} • {dmy(doc.purchase_date)}
              {doc.created_by && ` • By ${doc.created_by}`}
            </p>
          )}
        </div>
        {canReturn && picked.size > 0 && (
          <button
            type="button"
            onClick={() => openReturn([...picked])}
            className="no-print flex h-9 items-center gap-1.5 rounded-lg border border-danger px-3 text-sm text-danger hover:bg-danger/10"
          >
            <Undo2 size={14} /> Return selected ({picked.size})
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-bg"
        >
          <Printer size={14} /> Print bill
        </button>
      </div>

      {done && (
        <div
          role="status"
          className="no-print rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success"
        >
          {done}
        </div>
      )}
      {error && (
        <div className="no-print">
          <Err e={error} />
        </div>
      )}

      {doc && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stat("Total items", doc.items.length, "text-primary")}
            {stat("Total amount", `Rs. ${n(doc.total)}`)}
            {stat("Paid", `Rs. ${n(doc.paid)}`, "text-success")}
            {stat(
              "Due",
              `Rs. ${n(doc.due)}`,
              Number(doc.due) > 0 ? "text-danger" : "",
            )}
          </div>
          {doc.note && (
            <p className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
              <span className="text-muted">Note:</span> {doc.note}
            </p>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="no-print flex flex-wrap items-center gap-2 border-b border-border p-3">
              <button
                type="button"
                onClick={() => window.print()}
                className={tool}
              >
                <Printer size={13} className="text-danger" /> Print
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                title="Choose “Save as PDF” in the print dialog"
                className={tool}
              >
                <FileDown size={13} className="text-danger" /> PDF
              </button>
              <button
                type="button"
                onClick={exportCSV}
                title="Opens in Excel"
                className={tool}
              >
                <Table2 size={13} className="text-success" /> CSV / Excel
              </button>
              <button type="button" onClick={copyTable} className={tool}>
                <Copy size={13} className="text-primary" />{" "}
                {copied ? "Copied!" : "Copy"}
              </button>
              <div className="relative ml-auto">
                <Search
                  size={14}
                  className="absolute left-2.5 top-2.5 text-muted"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search IMEI, mobile, brand…"
                  aria-label="Search items"
                  className={`${ctl} !h-8 w-60 pl-8 text-xs`}
                />
              </div>
            </div>
            <div className="px-4 py-3 text-sm font-semibold">
              Purchase items{" "}
              <span className="font-normal text-muted">
                ({rows.length}
                {needle ? ` of ${doc.items.length}` : ""})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg/60 text-xs uppercase text-muted">
                  <tr>
                    {canReturn && (
                      <th className="no-print w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Select all in-stock"
                          disabled={returnable.length === 0}
                          checked={allPicked}
                          onChange={() =>
                            setPicked(
                              allPicked
                                ? new Set()
                                : new Set(returnable.map((i) => i.imei)),
                            )
                          }
                        />
                      </th>
                    )}
                    {head.map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 text-left font-medium ${h === "Cost price" ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                    {canReturn && <th className="no-print w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ it, no }) => {
                    const st = STATUS[it.status] ?? {
                      label: it.status,
                      cls: "bg-bg text-muted",
                    };
                    const can1 = it.status === "in_stock";
                    return (
                      <tr key={it.imei} className="border-t border-border">
                        {canReturn && (
                          <td className="no-print px-3 py-2">
                            {can1 ? (
                              <input
                                type="checkbox"
                                aria-label={`Select ${it.imei}`}
                                checked={picked.has(it.imei)}
                                onChange={() => toggle(it.imei)}
                              />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 text-muted">{no}</td>
                        <td className="px-3 py-2">
                          <code className="text-xs text-primary">
                            <Hit text={it.imei} q={needle} />
                          </code>
                        </td>
                        <td className="px-3 py-2">
                          <Hit text={it.model} q={needle} />
                        </td>
                        <td className="px-3 py-2">
                          <Hit text={it.brand} q={needle} />
                        </td>
                        <td className="px-3 py-2">
                          <Hit text={it.model_name} q={needle} />
                        </td>
                        <td className="px-3 py-2">
                          <Hit text={it.variant ?? "—"} q={needle} />
                        </td>
                        <td className="px-3 py-2">
                          <Hit text={it.color ?? "—"} q={needle} />
                        </td>
                        {hasCost && (
                          <td className="px-3 py-2 text-right">
                            Rs. {n(it.cost)}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        {canReturn && (
                          <td className="no-print px-2 py-2">
                            {can1 && (
                              <button
                                type="button"
                                title="Return to supplier"
                                aria-label={`Return ${it.imei}`}
                                onClick={() => openReturn([it.imei])}
                                className="rounded p-1 text-warning hover:bg-bg"
                              >
                                <Undo2 size={14} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {hasCost && rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-bg/60 font-bold">
                      <td
                        colSpan={(canReturn ? 1 : 0) + 7}
                        className="px-3 py-2 text-right text-muted"
                      >
                        Total amount
                      </td>
                      <td className="px-3 py-2 text-right text-primary">
                        Rs. {n(doc.total)}
                      </td>
                      <td colSpan={canReturn ? 2 : 1} />
                    </tr>
                  </tfoot>
                )}
              </table>
              {rows.length === 0 && (
                <p className="p-8 text-center text-sm text-muted">
                  No items found
                </p>
              )}
            </div>
          </div>
        </>
      )}
      {!doc && !error && <p className="text-sm text-muted">Loading…</p>}

      {modal && (
        <div
          className="no-print fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setModal(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center">
              <h2 className="flex items-center gap-2 text-lg font-bold text-danger">
                <Undo2 size={16} /> Purchase return
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModal(null)}
                className="ml-auto p-1 text-muted hover:text-text"
              >
                <X size={18} />
              </button>
            </div>
            {mErr && <Err e={mErr} />}
            <div className="max-h-36 overflow-y-auto rounded-lg bg-bg p-3 text-xs">
              {modal.map((imei) => (
                <div key={imei} className="flex justify-between py-1">
                  <code>{imei}</code>
                  {hasCost && <span>Rs. {n(costOf([imei]))}</span>}
                </div>
              ))}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">
                Return date
              </span>
              <input
                type="date"
                value={rdate}
                onChange={(e) => setRdate(e.target.value)}
                className={`${ctl} w-full`}
              />
            </label>
            <div>
              <span className="mb-2 block text-xs font-medium text-muted">
                Reason select karo
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1 text-xs ${reason === r ? "border-danger bg-danger/15 text-danger" : "border-border bg-bg hover:border-danger"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">
                Ya khud likho
              </span>
              <textarea
                rows={2}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason yahan likho…"
                className={`${ctl} h-auto w-full resize-none py-2`}
              />
            </label>
            {hasCost && (
              <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
                <span className="text-xs text-muted">Return amount</span>
                <b className="text-danger">Rs. {n(costOf(modal))}</b>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim() || !rdate}
                onClick={submitReturn}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Undo2 size={13} /> {busy ? "Saving…" : "Confirm return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
