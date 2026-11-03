"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Save,
  ScanLine,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { n } from "@/lib/format";
import Combo from "@/components/Combo";

/* ── types (shapes come from the Laravel API) ── */
type Cust = { id: number; name: string; phone?: string | null };
type Stock = {
  imei: string;
  status: string;
  model: string;
  brand: string;
  model_name: string;
  variant: string | null;
  color: string | null;
  cost?: string;
};
type Line = {
  imei: string;
  mobile: string;
  brand: string;
  model: string;
  variant: string | null;
  color: string | null;
  cost?: string;
  price: string;
};
type Sold = { invoice: string; date: string; customer: string };
type Status =
  { type: "not_found" } | { type: "sold"; imei: string; sold: Sold | null };

/* ── helpers ── */
const money = (v: string) => {
  const [a, ...r] = v.replace(/[^\d.]/g, "").split(".");
  return r.length ? `${a}.${r.join("").slice(0, 2)}` : a;
};
const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const cents = (v?: string | null) => Math.round((Number(v) || 0) * 100);
const fromCents = (c: number) => (c / 100).toFixed(2);
const dmy = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const ctl =
  "h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary read-only:opacity-70 disabled:opacity-50";
const lbl = "mb-1 block text-xs font-medium text-muted";
const ghost =
  "h-9 rounded-lg border border-border px-4 text-sm hover:bg-bg disabled:opacity-50";
const btn =
  "flex h-9 min-w-32 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50";

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
const Alert = ({ children }: { children: React.ReactNode }) => (
  <div
    role="alert"
    className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
  >
    {children}
  </div>
);

export default function NewSale() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [kind, setKind] = useState<"walkin" | "permanent">("walkin");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [bulk, setBulk] = useState("");
  const [scan, setScan] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [received, setReceived] = useState<string | null>(null); // null = full amount
  const [msg, setMsg] = useState<{ t: string; c: string } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const scanning = useRef(false);
  const focusScan = useCallback(
    () => setTimeout(() => scanRef.current?.focus(), 50),
    [],
  );
  const flash = (t: string, c = "text-success") => setMsg({ t, c });

  useEffect(() => {
    api<Cust[]>("/customers")
      .then(setCustomers)
      .catch((e) =>
        setError(e instanceof ApiError ? e : "Could not load customers."),
      );
  }, []);

  /* ── money (in cents, so 0.1 + 0.2 never breaks the exact-decimal check on the server) ── */
  const hasCost = lines.some((l) => l.cost !== undefined); // cost/profit are only sent to owners/admins
  const totalC = useMemo(
    () => lines.reduce((s, l) => s + cents(l.price), 0),
    [lines],
  );
  const profitC = useMemo(
    () => lines.reduce((s, l) => s + cents(l.price) - cents(l.cost), 0),
    [lines],
  );
  const walkin = kind === "walkin";
  const gotC = walkin || received === null ? totalC : cents(received); // walk-in sales are always paid in full
  const dueC = totalC - gotC;
  const patch = (i: number, p: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const customerOpts = customers.map((c) => ({
    value: String(c.id),
    label: c.phone ? `${c.name} (${c.phone})` : c.name,
  }));
  const createCustomer = async (name: string) => {
    const c = await api<Cust>("/customers", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setCustomers((x) => [...x, c]);
    setCustomerId(String(c.id));
  };

  /* ── scan ── */
  async function scanIMEI(raw: string) {
    const imei = raw.replace(/\D/g, "");
    if (scanning.current) return;
    if (imei.length !== 15)
      return flash("IMEI must be 15 digits.", "text-danger");
    if (lines.some((l) => l.imei === imei))
      return flash("Already in list!", "text-warning");
    if (lines.length >= 100)
      return flash("A sale can hold at most 100 phones.", "text-danger");
    scanning.current = true;
    try {
      const s = await api<Stock>(`/stock/${imei}`); // checks: valid, in stock, this branch, not sold
      setLines((ls) => [
        ...ls,
        {
          imei: s.imei,
          mobile: s.model,
          brand: s.brand,
          model: s.model_name,
          variant: s.variant,
          color: s.color,
          cost: s.cost,
          price: bulk,
        },
      ]);
      flash(`✓ Added: ${s.model}`);
      setScan("");
      focusScan();
    } catch (e) {
      if (e instanceof ApiError && e.problem.code === "NOT_IN_STOCK")
        setStatus({ type: "not_found" });
      else if (
        e instanceof ApiError &&
        e.problem.code === "STOCK_ALREADY_SOLD"
      ) {
        const f = (k: string) => e.field(k);
        setStatus({
          type: "sold",
          imei,
          sold: f("sold_invoice")
            ? {
                invoice: f("sold_invoice")!,
                date: f("sold_date") ?? "",
                customer: f("sold_customer") ?? "Walk-in",
              }
            : null,
        });
      } else
        flash(
          e instanceof ApiError ? e.message : "Error checking IMEI.",
          "text-danger",
        );
    } finally {
      scanning.current = false;
    }
  }
  const closeStatus = () => {
    setStatus(null);
    setScan("");
    focusScan();
  };

  /* ── save ── */
  async function save(printAfter = false) {
    if (busy) return;
    setError(null);
    const fail = (m: string) => {
      setError(m);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    if (lines.length === 0)
      return fail("Please add at least one item to the sale.");
    if (!date) return fail("Please enter a valid date.");
    if (!walkin && !customerId) return fail("Please select a customer.");
    if (lines.some((l) => !MONEY_RE.test(l.price) || cents(l.price) <= 0))
      return fail(
        "One or more items have no sale price. Please enter a valid sale price.",
      );
    if (
      !walkin &&
      received !== null &&
      received !== "" &&
      !MONEY_RE.test(received)
    )
      return fail("Received amount must be a number, e.g. 25000 or 25000.50.");
    if (gotC > totalC)
      return fail("Received amount is more than the sale total.");

    const walkNote =
      walkin && (walkName.trim() || walkPhone.trim())
        ? `Walk-in: ${[walkName.trim(), walkPhone.trim() && `(${walkPhone.trim()})`].filter(Boolean).join(" ")}`
        : "";
    const fullNote = [walkNote, note.trim()]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500);

    setBusy(true);
    try {
      const r = await api<{ id: number }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customer_id: walkin ? null : Number(customerId),
          sale_date: date,
          received: fromCents(gotC),
          note: fullNote || null,
          items: lines.map((l) => ({ imei: l.imei, price: l.price })),
        }),
      });
      router.replace(printAfter ? `/sales/${r.id}?print=1` : "/sales");
    } catch (e) {
      setError(e instanceof ApiError ? e : "Could not save the sale.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  /* ── shortcuts: Alt+Enter / Ctrl+S save, Alt+P / Ctrl+P save & print, Esc / Enter close the status modal ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (status) {
        if (k === "escape" || k === "enter") {
          e.preventDefault();
          closeStatus();
        }
        return;
      }
      if ((e.altKey && k === "enter") || (e.ctrlKey && k === "s")) {
        e.preventDefault();
        saveRef.current(false);
      } else if ((e.altKey && k === "p") || (e.ctrlKey && k === "p")) {
        e.preventDefault();
        saveRef.current(true);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  });

  const imeiErrors =
    error instanceof ApiError ? error.problem.errors?.imei : undefined;
  const th = [
    "#",
    "IMEI",
    "Mobile",
    "Brand",
    "Model",
    "Variant",
    "Color",
    ...(hasCost ? ["Cost"] : []),
    "Sale price (Rs.)",
    ...(hasCost ? ["Profit"] : []),
    "",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.push("/sales")}
          className="rounded-lg p-2 text-muted hover:bg-bg"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">New sale</h1>
          <p className="text-xs text-muted">
            The invoice number is given when you save.
          </p>
        </div>
      </div>

      {error && (
        <Alert>
          {typeof error === "string" ? error : error.message}
          {imeiErrors && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {imeiErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <label className="text-sm">
          <span className={lbl}>Customer type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "walkin" | "permanent")}
            className={ctl}
          >
            <option value="walkin">Walk-in customer</option>
            <option value="permanent">Permanent customer</option>
          </select>
        </label>
        {walkin ? (
          <>
            <label className="text-sm">
              <span className={lbl}>Customer name</span>
              <input
                value={walkName}
                maxLength={120}
                onChange={(e) => setWalkName(e.target.value)}
                placeholder="Name"
                className={ctl}
              />
            </label>
            <label className="text-sm">
              <span className={lbl}>Phone</span>
              <input
                value={walkPhone}
                maxLength={30}
                inputMode="tel"
                onChange={(e) => setWalkPhone(e.target.value)}
                placeholder="Phone"
                className={ctl}
              />
            </label>
          </>
        ) : (
          <div className="md:col-span-2">
            <span className={lbl}>Customer *</span>
            <Combo
              label="Customer"
              value={customerId}
              onChange={setCustomerId}
              options={customerOpts}
              placeholder="Type customer name…"
              onCreate={createCustomer}
            />
          </div>
        )}
        <label className="text-sm">
          <span className={lbl}>Date *</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={ctl}
          />
        </label>
        <label className="text-sm md:col-span-4">
          <span className={lbl}>Notes</span>
          <input
            value={note}
            maxLength={400}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional…"
            className={ctl}
          />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <ScanLine size={16} className="text-success" />
          <h3 className="text-sm font-semibold">IMEI scanner</h3>
          <span className="text-xs text-muted">Scan IMEI to add sale item</span>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            Bulk sale price
            <input
              inputMode="decimal"
              value={bulk}
              placeholder="0"
              className={`${ctl} !w-28`}
              onChange={(e) => {
                const v = money(e.target.value);
                setBulk(v);
                setLines((ls) => ls.map((l) => ({ ...l, price: v })));
              }}
            />
          </label>
        </div>
        <input
          ref={scanRef}
          autoFocus
          aria-label="IMEI"
          inputMode="numeric"
          maxLength={15}
          value={scan}
          placeholder="Scan IMEI here…"
          className={`${ctl} text-base tracking-widest`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setScan(v);
            if (v.length === 15) scanIMEI(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.altKey) {
              e.preventDefault();
              scanIMEI(scan);
            }
          }}
        />
        {msg && (
          <div role="status" className={`mt-2 text-sm ${msg.c}`}>
            {msg.t}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">
            Items <span className="text-muted">({lines.length})</span>
          </h3>
          {lines.length > 0 && (
            <div className="flex gap-4 text-xs text-muted">
              <span>
                Total:{" "}
                <b className="text-success">Rs. {n(fromCents(totalC))}</b>
              </span>
              {hasCost && (
                <span>
                  Profit:{" "}
                  <b className={profitC >= 0 ? "text-success" : "text-danger"}>
                    Rs. {n(fromCents(profitC))}
                  </b>
                </span>
              )}
            </div>
          )}
        </div>
        {lines.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            Scan IMEI to add sale items
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/60 text-xs uppercase text-muted">
                <tr>
                  {th.map((h, i) => (
                    <th
                      key={`${h}${i}`}
                      className="px-3 py-2 text-left font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = cents(l.price) - cents(l.cost);
                  return (
                    <tr key={l.imei} className="border-t border-border">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2">
                        <code className="text-xs">{l.imei}</code>
                      </td>
                      <td className="px-3 py-2">{l.mobile}</td>
                      <td className="px-3 py-2">{l.brand}</td>
                      <td className="px-3 py-2">{l.model}</td>
                      <td className="px-3 py-2">{l.variant ?? "-"}</td>
                      <td className="px-3 py-2">{l.color ?? "-"}</td>
                      {hasCost && (
                        <td className="px-3 py-2 text-muted">
                          Rs. {n(l.cost)}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <input
                          aria-label="Sale price"
                          inputMode="decimal"
                          value={l.price}
                          onChange={(e) =>
                            patch(i, { price: money(e.target.value) })
                          }
                          className={`${ctl} !w-28`}
                        />
                      </td>
                      {hasCost && (
                        <td
                          className={`px-3 py-2 font-semibold ${p >= 0 ? "text-success" : "text-danger"}`}
                        >
                          Rs. {n(fromCents(p))}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() =>
                            setLines((ls) => ls.filter((_, j) => j !== i))
                          }
                          className="rounded p-1 text-muted hover:text-danger"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/sales")}
          className={ghost}
        >
          Cancel
        </button>
        <span className="text-sm text-muted">
          {lines.length} phones · Total{" "}
          <b className="text-text">Rs. {n(fromCents(totalC))}</b>
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Received
          <input
            inputMode="decimal"
            aria-label="Received"
            disabled={walkin}
            value={
              walkin || received === null
                ? fromCents(totalC).replace(/\.00$/, "")
                : received
            }
            onChange={(e) => setReceived(money(e.target.value))}
            className={`${ctl} !w-32`}
          />
        </label>
        {!walkin && dueC > 0 && (
          <span className="text-sm text-warning">Due {n(fromCents(dueC))}</span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => save(true)}
          title="Alt+P / Ctrl+P"
          className={`${btn} bg-primary`}
        >
          <Save size={14} /> Save and print
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save(false)}
          title="Alt+Enter / Ctrl+S"
          className={`${btn} bg-success`}
        >
          <Save size={14} /> {busy ? "Saving…" : "Save sale"}
        </button>
      </div>

      {status && (
        <Modal onClose={closeStatus}>
          {status.type === "not_found" ? (
            <>
              <div className="flex items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm font-medium text-danger">
                <AlertCircle size={20} /> IMEI not found in stock!
              </div>
              <p className="text-center text-sm text-muted">
                The scanned IMEI is not in purchase records.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-warning">
                <TriangleAlert size={20} /> IMEI already sold!
              </div>
              <p className="text-center text-xs text-muted">
                <code>{status.imei}</code>
              </p>
              {status.sold && (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted">Invoice:</span>{" "}
                    <b>{status.sold.invoice}</b>
                  </p>
                  {status.sold.date && (
                    <p>
                      <span className="text-muted">Sale date:</span>{" "}
                      <b>{dmy(status.sold.date)}</b>
                    </p>
                  )}
                  <p>
                    <span className="text-muted">Customer:</span>{" "}
                    <b>{status.sold.customer}</b>
                  </p>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={closeStatus}
            className="mx-auto flex h-9 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-white"
          >
            OK
          </button>
        </Modal>
      )}
    </div>
  );
}