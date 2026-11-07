"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();
const ctl =
  "h-9 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary read-only:opacity-70 disabled:opacity-50";

/**
 * Type-ahead field. Nothing opens on click: as you type, the matching options appear underneath.
 * If nothing matches exactly, an "+ Add “text”" row creates it on the spot (onCreate) and selects it.
 * The list is position:fixed so the scrolling items table can't clip it.
 */
export default function Combo({
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
