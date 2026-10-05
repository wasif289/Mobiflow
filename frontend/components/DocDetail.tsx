"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";

type Item = {
  imei: string;
  model: string;
  price?: string;
  cost?: string;
  status?: string;
  returned?: boolean;
};
type Doc = {
  invoice_no: string;
  supplier?: string;
  customer?: string | null;
  total: string;
  paid?: string;
  received?: string;
  due: string;
  purchase_date?: string;
  sale_date?: string;
  items: Item[];
};
const fmt = (v?: string) =>
  v === undefined ? "—" : Number(v).toLocaleString("en-PK");

export default function DocDetail({
  kind,
  id,
}: {
  kind: "purchase" | "sale";
  id: string;
}) {
  const role = useSession((s) => s.user?.role);
  const canReturn = role === "owner" || role === "admin";
  const [doc, setDoc] = useState<Doc | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<ApiError | string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = kind === "purchase" ? "/purchases" : "/sales";

  const load = useCallback(() => {
    api<Doc>(`${base}/${id}`)
      .then(setDoc)
      .catch((e) => setError(e instanceof ApiError ? e : "Failed to load."));
  }, [base, id]);
  useEffect(load, [load]);

  const returnable = (i: Item) =>
    kind === "purchase" ? i.status === "in_stock" : !i.returned;
  const label = (i: Item) =>
    kind === "purchase"
      ? (i.status ?? "").replace(/_/g, " ")
      : i.returned
        ? "returned"
        : "sold";
  const toggle = (imei: string) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(imei) ? n.delete(imei) : n.add(imei);
      return n;
    });

  async function submit() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api<{
        return_no: string;
        total: string;
        refund?: string;
      }>(`${base}/${id}/returns`, {
        method: "POST",
        body: JSON.stringify({
          imeis: [...picked],
          reason,
          return_date: new Date().toISOString().slice(0, 10),
        }),
      });
      setDone(
        `Return ${r.return_no} saved (${fmt(r.total)}).${r.refund === "cash" ? " Walk-in sale: give the customer cash back." : ""}`,
      );
      setPicked(new Set());
      setReason("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e : "Could not save the return.");
    } finally {
      setBusy(false);
    }
  }

  const imeiErrors =
    error instanceof ApiError ? error.problem.errors?.imei : undefined;
  const input =
    "rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <div className="space-y-4">
      <Link href={base} className="text-sm text-muted">
        ← {kind === "purchase" ? "Purchases" : "Sales"}
      </Link>
      {doc && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <h1 className="text-xl font-bold">{doc.invoice_no}</h1>
            <span className="text-sm text-muted">
              {doc.purchase_date ?? doc.sale_date} ·{" "}
              {doc.supplier ?? doc.customer ?? "Walk-in"}
            </span>
            <span className="ml-auto text-sm">
              Total <b>{fmt(doc.total)}</b> ·{" "}
              {kind === "purchase" ? "Paid" : "Received"}{" "}
              <b className="text-success">{fmt(doc.paid ?? doc.received)}</b> ·
              Due <b>{fmt(doc.due)}</b>
            </span>
          </div>
        </div>
      )}
      {done && (
        <div
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success"
        >
          {done}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          {typeof error === "string" ? error : error.message}
          {imeiErrors && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {imeiErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="rounded-xl border border-border bg-card">
        {!doc && !error && <p className="p-4 text-sm text-muted">Loading…</p>}
        {doc?.items.map((i) => (
          <label
            key={i.imei}
            className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-0"
          >
            {canReturn && (
              <input
                type="checkbox"
                disabled={!returnable(i)}
                checked={picked.has(i.imei)}
                onChange={() => toggle(i.imei)}
                aria-label={`Return ${i.imei}`}
              />
            )}
            <span className="w-40 text-sm font-medium">{i.imei}</span>
            <span className="flex-1 text-sm text-muted">{i.model}</span>
            <span className="text-sm">{fmt(i.cost ?? i.price)}</span>
            <span
              className={`w-36 text-right text-xs ${returnable(i) ? "text-success" : "text-muted"}`}
            >
              {label(i)}
            </span>
          </label>
        ))}
      </div>
      {canReturn && doc && (
        <div className="flex flex-wrap gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for return"
            className={`${input} min-w-56 flex-1`}
          />
          <button
            disabled={busy || picked.size === 0 || !reason.trim()}
            onClick={submit}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : `Return ${picked.size || ""} phone${picked.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
