"use client";
import {
  useCallback,
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  ScanBarcode,
  ScanLine,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useCan } from "@/lib/can";
import { n } from "@/lib/format";

/* ── types (shapes come from the Laravel API) ── */
type Opt = { id: number; name: string };
type Supplier = Opt & { phone?: string | null };
type Model = Opt & { brand_id: number; brand?: { name: string } };
type Variant = Opt & { device_model_id: number };
type InStock = {
  status: string;
  device: string;
  invoice_no: string | null;
  supplier: string | null;
  date: string | null;
  branch: string | null;
};
type Lookup = {
  imei: string;
  tac: string;
  model: { id: number; name: string; brand: string } | null;
  in_stock: InStock | null;
};
type Line = {
  imei: string;
  modelId: number;
  device: string;
  variantId: string;
  colorId: string;
  cost: string;
};
type Page<T> = { data: T[]; current_page: number; last_page: number };

/* ── helpers ── */
const money = (v: string) => {
  const [a, ...r] = v.replace(/[^\d.]/g, "").split(".");
  return r.length ? `${a}.${r.join("").slice(0, 2)}` : a;
};
const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();
const modelLabel = (m: Model) => `${m.brand?.name ?? ""} ${m.name}`.trim();
const post = <T,>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });

/** The catalog endpoints are paginated (50/page): walk every page. */
async function loadAll<T>(resource: string): Promise<T[]> {
  const out: T[] = [];
  for (let p = 1; ; p++) {
    const r = await api<Page<T>>(`/catalog/${resource}?page=${p}`);
    out.push(...r.data);
    if (r.current_page >= r.last_page) return out;
  }
}

const ctl =
  "h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary read-only:opacity-70 disabled:opacity-50";
const lbl = "mb-1 block text-xs font-medium text-muted";
const ghost =
  "h-9 rounded-lg border border-border px-3 text-sm hover:bg-bg disabled:opacity-50";
const primary =
  "h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50";

function Modal({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto p-1 text-muted hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
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

/**
 * Type-ahead field. Nothing opens on click: as you type, the matching options appear underneath.
 * If nothing matches exactly, an "+ Add “text”" row creates it on the spot (onCreate) and selects it.
 * The list is position:fixed so the scrolling items table can't clip it.
 */
function Combo({
  value,
  onChange,
  options,
  placeholder,
  label,
  onCreate,
  createLabel,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  label: string;
  onCreate?: (name: string) => Promise<void>;
  createLabel?: (name: string) => string;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null); // null = not editing, show the selected label
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 });
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = (text ?? "").trim();
  const open = text !== null && q !== "";
  const cur = options.find((o) => o.value === value);
  const shown = open
    ? options
        .filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 50)
    : [];
  const canAdd = open && !!onCreate && !options.some((o) => same(o.label, q));
  const count = shown.length + (canAdd ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) setText(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const place = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r)
      setBox({
        top: r.bottom + 4,
        left: r.left,
        width: Math.max(r.width, 220),
      });
  };
  const pick = (v: string) => {
    onChange(v);
    setText(null);
  };
  async function create() {
    if (!onCreate || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onCreate(q);
      setText(null);
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? (e.field("name") ?? e.message)
          : "Could not add. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open || !count) return;
      e.preventDefault();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : count - 1)) % count);
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      if (active < shown.length) pick(shown[active].value);
      else if (canAdd) create();
    } else if (e.key === "Escape" && open) {
      e.nativeEvent.stopPropagation();
      setText(null); // close the list only, not the surrounding modal
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        className={ctl}
        placeholder={placeholder}
        value={text ?? cur?.label ?? ""}
        onFocus={(e) => {
          e.target.select();
          place();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setErr(null);
          place();
        }}
        onBlur={() => {
          if (text === "" && value) onChange("");
          setText(null);
          setErr(null);
        }}
        onKeyDown={onKey}
      />
      {open && (
        <div
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-[60] rounded-lg border border-border bg-card shadow-lg"
          style={box}
        >
          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-auto text-sm"
          >
            {shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-primary text-white" : o.value === value ? "bg-primary/10" : ""}`}
              >
                {o.label}
              </li>
            ))}
            {canAdd && (
              <li
                role="option"
                aria-selected={active === shown.length}
                onMouseEnter={() => setActive(shown.length)}
                onClick={create}
                className={`cursor-pointer px-3 py-1.5 font-medium ${shown.length ? "border-t border-border" : ""} ${active === shown.length ? "bg-primary text-white" : "text-primary"}`}
              >
                {busy
                  ? "Adding…"
                  : (createLabel ?? ((t: string) => `+ Add “${t}”`))(q)}
              </li>
            )}
            {count === 0 && (
              <li className="px-3 py-2 text-muted">No results</li>
            )}
          </ul>
          {err && (
            <p className="border-t border-border px-3 py-1.5 text-xs text-danger">
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewPurchase() {
  const router = useRouter();
  const can = useCan();
  const canCatalog = can("catalog.manage");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Opt[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [colors, setColors] = useState<Opt[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState("");
  const [bulk, setBulk] = useState("");
  const [scan, setScan] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [lock, setLock] = useState(""); // variant name applied to every newly scanned phone
  const [msg, setMsg] = useState<{ t: string; c: string } | null>(null);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [badImeis, setBadImeis] = useState<string[]>([]);
  const [dupModal, setDupModal] = useState(false);
  const [dup, setDup] = useState<{ imei: string; info: InStock } | null>(null); // found at scan time

  const [tacOpen, setTacOpen] = useState(false);
  const [tac, setTac] = useState({ imei: "", tac: "", brand: "", modelId: "" });
  const [mErr, setMErr] = useState<ApiError | string | null>(null);
  const [mBusy, setMBusy] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const scanning = useRef(false);
  const variantsRef = useRef<Variant[]>([]);
  const inflight = useRef(new Map<string, Promise<Variant>>());
  const focusScan = useCallback(
    () => setTimeout(() => scanRef.current?.focus(), 50),
    [],
  );
  const flash = (t: string, c = "text-success") => setMsg({ t, c });

  useEffect(() => {
    const fail = (e: unknown) =>
      setError(e instanceof ApiError ? e : "Could not load the form data.");
    api<Supplier[]>("/suppliers").then(setSuppliers).catch(fail);
    loadAll<Opt>("brands").then(setBrands).catch(fail);
    loadAll<Model>("models").then(setModels).catch(fail);
    loadAll<Variant>("variants")
      .then((v) => {
        variantsRef.current = v;
        setVariants(v);
      })
      .catch(fail);
    loadAll<Opt>("colors").then(setColors).catch(fail);
  }, []);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.cost) || 0), 0),
    [lines],
  );
  const modelName = useMemo(
    () => new Map(models.map((m) => [m.id, modelLabel(m)])),
    [models],
  );
  const variantNames = useMemo(() => {
    const seen = new Map<string, string>();
    variants.forEach((v) => {
      if (!seen.has(v.name.toLowerCase()))
        seen.set(v.name.toLowerCase(), v.name);
    });
    return [...seen.values()].sort();
  }, [variants]);
  const patch = (i: number, p: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const patchImei = (imei: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.imei === imei ? { ...l, ...p } : l)));

  /* ── "type it and add it" creators: each one saves to the catalog and selects the new record ── */
  const createSupplier = async (name: string) => {
    const s = await post<Supplier>("/suppliers", { name });
    setSuppliers((x) => [...x, s]);
    setSupplierId(String(s.id));
  };
  const createColor = (imei: string) => async (name: string) => {
    const c = await post<Opt>("/catalog/colors", { name });
    setColors((x) => [...x, c]);
    patchImei(imei, { colorId: String(c.id) });
  };
  /** Finds the variant of this model by name, or creates it once (even if two phones are scanned together). */
  function ensureVariant(modelId: number, name: string): Promise<Variant> {
    const found = variantsRef.current.find(
      (x) => x.device_model_id === modelId && same(x.name, name),
    );
    if (found) return Promise.resolve(found);
    const key = `${modelId}:${name.trim().toLowerCase()}`;
    let p = inflight.current.get(key);
    if (!p) {
      p = post<Variant>("/catalog/variants", {
        device_model_id: modelId,
        name: name.trim(),
      })
        .then((v) => {
          variantsRef.current = [...variantsRef.current, v];
          setVariants(variantsRef.current);
          return v;
        })
        .finally(() => inflight.current.delete(key));
      inflight.current.set(key, p);
    }
    return p;
  }
  const createVariant =
    (imei: string, modelId: number) => async (name: string) => {
      const v = await ensureVariant(modelId, name);
      patchImei(imei, { variantId: String(v.id) });
    };
  const createBrand = async (name: string) => {
    const b = await post<Opt>("/catalog/brands", { name });
    setBrands((x) => [...x, b]);
    setTac((t) => ({ ...t, brand: String(b.id), modelId: "" }));
  };
  const createModel = async (name: string) => {
    const m = await post<Model>("/catalog/models", {
      brand_id: Number(tac.brand),
      name,
    });
    const full: Model = {
      ...m,
      brand_id: Number(tac.brand),
      brand: {
        name: brands.find((b) => String(b.id) === tac.brand)?.name ?? "",
      },
    };
    setModels((x) => [...x, full]);
    setTac((t) => ({ ...t, modelId: String(m.id) }));
  };

  /* ── add a scanned phone ── */
  function addLine(imei: string, modelId: number, device: string) {
    const v = lock
      ? variants.find(
          (x) => x.device_model_id === modelId && same(x.name, lock),
        )
      : undefined;
    setLines((ls) => [
      ...ls,
      {
        imei,
        modelId,
        device,
        variantId: v ? String(v.id) : "",
        colorId: "",
        cost: bulk,
      },
    ]);
    flash(`✓ Added: ${device}`);
    if (lock && !v) {
      if (canCatalog) {
        // this model has no such variant yet: create it automatically
        ensureVariant(modelId, lock)
          .then((nv) => patchImei(imei, { variantId: String(nv.id) }))
          .catch(() =>
            flash(
              `Added ${device}, but the "${lock}" variant could not be created.`,
              "text-warning",
            ),
          );
      } else
        flash(
          `Added ${device}, but it has no "${lock}" variant. Pick one in the row.`,
          "text-warning",
        );
    }
    setScan("");
    focusScan();
  }

  async function scanIMEI(raw: string) {
    const imei = raw.replace(/\D/g, "");
    if (scanning.current) return;
    if (imei.length !== 15)
      return flash("IMEI must be 15 digits.", "text-danger");
    if (lines.some((l) => l.imei === imei))
      return flash("IMEI already in this list!", "text-warning");
    scanning.current = true;
    try {
      const r = await api<Lookup>(`/imei/${imei}`); // validates (Luhn) + detects model from the TAC + checks stock
      if (r.in_stock) {
        setDup({ imei: r.imei, info: r.in_stock });
        setMsg(null);
        setScan("");
        return;
      }
      if (r.model)
        addLine(r.imei, r.model.id, `${r.model.brand} ${r.model.name}`);
      else {
        setTac({ imei: r.imei, tac: r.tac, brand: "", modelId: "" });
        setMErr(null);
        setTacOpen(true);
      }
    } catch (e) {
      flash(
        e instanceof ApiError ? e.message : "IMEI lookup failed.",
        "text-danger",
      );
    } finally {
      scanning.current = false;
    }
  }

  /* ── unknown TAC: pick (or type-and-add) brand + model, then remember the TAC ── */
  const tacModels = models.filter((m) => String(m.brand_id) === tac.brand);
  const tacModel = tacModels.find((m) => String(m.id) === tac.modelId);
  const closeTac = () => {
    setTacOpen(false);
    setScan("");
    focusScan();
  };
  async function confirmTac() {
    if (!tacModel) return;
    setMBusy(true);
    setMErr(null);
    try {
      if (canCatalog)
        await post("/tac-mappings", {
          tac: tac.tac,
          device_model_id: tacModel.id,
        });
      addLine(tac.imei, tacModel.id, modelLabel(tacModel));
      setTacOpen(false);
    } catch (e) {
      setMErr(e instanceof ApiError ? e : "Something went wrong. Try again.");
    } finally {
      setMBusy(false);
    }
  }

  /* ── save ── */
  async function save(printAfter = false) {
    if (busy) return;
    setError(null);
    setBadImeis([]);
    const fail = (m: string) => {
      setError(m);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    if (!supplierId) return fail("Please select a supplier first.");
    if (!date) return fail("Please select a purchase date.");
    if (lines.length === 0) return fail("Please add at least one phone.");
    if (lines.length > 200)
      return fail("A purchase can hold at most 200 phones. Split it into two.");
    if (lines.some((l) => !MONEY_RE.test(l.cost) || Number(l.cost) <= 0))
      return fail("Please enter a cost price for every phone.");
    if (paid && !MONEY_RE.test(paid))
      return fail("Paid amount must be a number, e.g. 25000 or 25000.50.");
    if (Number(paid || 0) > total)
      return fail("Paid amount is more than the purchase total.");

    setBusy(true);
    try {
      const r = await post<{ id: number }>("/purchases", {
        supplier_id: Number(supplierId),
        purchase_date: date,
        paid: paid || "0",
        note: note.trim() || null,
        items: lines.map((l) => ({
          imei: l.imei,
          device_model_id: l.modelId,
          variant_id: l.variantId ? Number(l.variantId) : null,
          color_id: l.colorId ? Number(l.colorId) : null,
          cost: l.cost,
        })),
      });
      router.replace(printAfter ? `/purchases/${r.id}?print=1` : "/purchases");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.problem.code === "IMEI_ALREADY_IN_STOCK") {
          setBadImeis(e.problem.errors?.imei ?? []);
          setDupModal(true);
        }
        setError(e);
      } else setError("Could not save the purchase.");
    } finally {
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTacOpen(false);
        setDupModal(false);
        setDup(null);
        return;
      }
      if (tacOpen || dupModal || dup) return;
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current(false);
      } else if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        saveRef.current(true);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [tacOpen, dupModal, dup]);

  const imeiErrors =
    error instanceof ApiError ? error.problem.errors?.imei : undefined;
  const supplierOpts = suppliers.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
  const colorOpts = colors.map((c) => ({ value: String(c.id), label: c.name }));
  const brandOpts = brands.map((b) => ({ value: String(b.id), label: b.name }));
  const tacModelOpts = tacModels.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));
  const lockOpts = variantNames.map((v) => ({ value: v, label: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.push("/purchases")}
          className="rounded-lg p-2 text-muted hover:bg-bg"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">New purchase</h1>
          <p className="text-xs text-muted">
            The entry number is given when you save.
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
        <div className="md:col-span-2">
          <span className={lbl}>Supplier *</span>
          <Combo
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={supplierOpts}
            placeholder="Type supplier name…"
            onCreate={createSupplier}
          />
        </div>
        <label className="text-sm">
          <span className={lbl}>Date *</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={ctl}
          />
        </label>
        <label className="text-sm">
          <span className={lbl}>Note</span>
          <input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note…"
            className={ctl}
          />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <ScanLine size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">IMEI scanner</h3>
          <span className="text-xs text-muted">
            Scan or type the IMEI. It is added at 15 digits.
          </span>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            Bulk price
            <input
              inputMode="decimal"
              value={bulk}
              placeholder="0"
              className={`${ctl} !w-28`}
              onChange={(e) => {
                const v = money(e.target.value);
                setBulk(v);
                setLines((ls) => ls.map((l) => ({ ...l, cost: v })));
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={scanRef}
            autoFocus
            aria-label="IMEI"
            inputMode="numeric"
            maxLength={15}
            value={scan}
            placeholder="Scan IMEI here…"
            className={`${ctl} min-w-56 flex-1 tracking-widest`}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setScan(v);
              if (v.length === 15) scanIMEI(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                scanIMEI(scan);
              }
            }}
          />
          <div className="flex min-w-56 flex-1 items-center gap-2">
            <Combo
              label="Variant for new phones"
              className="min-w-0 flex-1"
              value={lock}
              onChange={(v) => {
                setLock(v);
                focusScan();
              }}
              options={lockOpts}
              placeholder="Variant for new phones… (type, e.g. 8GB/128GB)"
              onCreate={
                canCatalog
                  ? async (name) => {
                      setLock(name.trim());
                      focusScan();
                    }
                  : undefined
              }
              createLabel={(t) => `+ Use “${t}” for new phones`}
            />
            {lock && (
              <button
                type="button"
                onClick={() => {
                  setLock("");
                  focusScan();
                }}
                className={ghost}
              >
                Unlock
              </button>
            )}
          </div>
        </div>
        {msg && (
          <div role="status" className={`mt-2 text-sm ${msg.c}`}>
            {msg.t}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">
            Phones <span className="text-muted">({lines.length})</span>
          </h3>
          {lines.length > 0 && (
            <span className="text-sm text-muted">
              Total <b className="text-primary">Rs. {n(total)}</b>
            </span>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="flex flex-col items-center p-8 text-muted">
            <ScanBarcode size={32} className="mb-2 opacity-40" />
            <p className="text-sm">Scan an IMEI to add the first phone.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/60 text-xs uppercase text-muted">
                <tr>
                  {[
                    "#",
                    "IMEI",
                    "Phone",
                    "Variant",
                    "Color",
                    "Cost (Rs.)",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const own = variants
                    .filter((v) => v.device_model_id === l.modelId)
                    .map((v) => ({ value: String(v.id), label: v.name }));
                  const bad = badImeis.includes(l.imei);
                  return (
                    <tr
                      key={l.imei}
                      className={`border-t border-border ${bad ? "bg-danger/10" : ""}`}
                    >
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2">
                        <code className={`text-xs ${bad ? "text-danger" : ""}`}>
                          {l.imei}
                        </code>
                      </td>
                      <td className="px-3 py-2">
                        {modelName.get(l.modelId) ?? l.device}
                      </td>
                      <td className="px-3 py-2">
                        <Combo
                          label="Variant"
                          className="w-44"
                          value={l.variantId}
                          onChange={(v) => patch(i, { variantId: v })}
                          options={own}
                          placeholder="Type variant…"
                          onCreate={
                            canCatalog
                              ? createVariant(l.imei, l.modelId)
                              : undefined
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Combo
                          label="Color"
                          className="w-40"
                          value={l.colorId}
                          onChange={(v) => patch(i, { colorId: v })}
                          options={colorOpts}
                          placeholder="Type color…"
                          onCreate={
                            canCatalog ? createColor(l.imei) : undefined
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          aria-label="Cost price"
                          inputMode="decimal"
                          value={l.cost}
                          onChange={(e) =>
                            patch(i, { cost: money(e.target.value) })
                          }
                          className={`${ctl} !w-28`}
                        />
                      </td>
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
          onClick={() => router.push("/purchases")}
          className={ghost}
        >
          Cancel
        </button>
        <span className="text-sm text-muted">
          {lines.length} phones · Rs. {n(total)}
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Paid now
          <input
            inputMode="decimal"
            value={paid}
            placeholder="0"
            onChange={(e) => setPaid(money(e.target.value))}
            className={`${ctl} !w-32`}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => save(true)}
          title="Ctrl+P"
          className={`${ghost} flex items-center gap-1.5`}
        >
          <Save size={14} /> Save &amp; print
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save(false)}
          title="Ctrl+S"
          className={`${primary} flex items-center gap-1.5`}
        >
          <Save size={14} /> {busy ? "Saving…" : "Save purchase"}
        </button>
      </div>

      {tacOpen && (
        <Modal title="Unknown device" onClose={closeTac}>
          <div className="space-y-3">
            <p className="text-xs text-muted">
              TAC <b className="text-primary">{tac.tac}</b> is not known yet.
              Type the brand and model: pick a match, or add it if it is new.
              Every IMEI with this TAC is recognised next time.
            </p>
            {mErr && (
              <Alert>{typeof mErr === "string" ? mErr : mErr.message}</Alert>
            )}
            <div>
              <span className={lbl}>Brand *</span>
              <Combo
                label="Brand"
                value={tac.brand}
                onChange={(v) => setTac({ ...tac, brand: v, modelId: "" })}
                options={brandOpts}
                placeholder="Type brand, e.g. Samsung"
                onCreate={canCatalog ? createBrand : undefined}
              />
            </div>
            <div>
              <span className={lbl}>Model *</span>
              <Combo
                label="Model"
                disabled={!tac.brand}
                value={tac.modelId}
                onChange={(v) => setTac({ ...tac, modelId: v })}
                options={tacModelOpts}
                placeholder={
                  tac.brand
                    ? "Type model, e.g. Galaxy S24"
                    : "Select a brand first"
                }
                onCreate={canCatalog ? createModel : undefined}
              />
            </div>
            {!canCatalog && (
              <p className="text-xs text-warning">
                You can only pick a brand and model that already exist. Ask an
                admin to add new ones.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeTac}
                className={`${ghost} flex-1`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!tacModel || mBusy}
                onClick={confirmTac}
                className={`${primary} flex-1`}
              >
                {mBusy ? "Saving…" : "Confirm & add"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dup && (
        <Modal
          title={
            <span className="flex items-center gap-2 text-danger">
              <TriangleAlert size={20} /> Duplicate IMEI
            </span>
          }
          onClose={() => {
            setDup(null);
            focusScan();
          }}
        >
          <Alert>IMEI: {dup.imei}</Alert>
          <p className="text-sm text-muted">
            This phone is already{" "}
            {dup.info.status === "in_transit"
              ? "in transit between branches"
              : "in stock"}
            , so it cannot be purchased again.
          </p>
          <div className="space-y-1 text-sm">
            {(
              [
                ["Entry no", dup.info.invoice_no],
                ["Supplier", dup.info.supplier],
                ["Date", dup.info.date],
                ["Branch", dup.info.branch],
                ["Phone", dup.info.device],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <p key={k}>
                  <span className="text-muted">{k}:</span> <b>{v}</b>
                </p>
              ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setDup(null);
              focusScan();
            }}
            className={`${primary} w-full`}
          >
            OK, got it
          </button>
        </Modal>
      )}

      {dupModal && (
        <Modal
          title={
            <span className="flex items-center gap-2 text-danger">
              <TriangleAlert size={20} /> Already in stock
            </span>
          }
          onClose={() => setDupModal(false)}
        >
          <p className="text-sm text-muted">
            These phones are already in stock, so the purchase was not saved.
            Remove them (highlighted in the list) and save again.
          </p>
          <ul className="max-h-48 list-disc space-y-1 overflow-auto pl-5 text-sm">
            {badImeis.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setDupModal(false);
              focusScan();
            }}
            className={`${primary} w-full`}
          >
            OK, got it
          </button>
        </Modal>
      )}
    </div>
  );
}
