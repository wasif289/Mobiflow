"use client";
import { Printer } from "lucide-react";
import { printVoucher, type SlipKind } from "@/lib/printslip";
import { cn } from "@/lib/utils";

/** Two one-click buttons for any voucher row: thermal slip (80 mm) and A4 page. Prints right here, no new tab. */
export default function VoucherPrintButtons({
  kind,
  id,
  className,
}: {
  kind: SlipKind;
  id: number;
  className?: string;
}) {
  const btn =
    "no-print grid h-7 min-w-7 place-items-center rounded-md border border-border px-1.5 text-muted transition hover:border-primary hover:text-primary";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <button
        type="button"
        title="Print thermal slip (80 mm)"
        aria-label="Print thermal slip"
        onClick={() => printVoucher(kind, id, "thermal")}
        className={btn}
      >
        <Printer size={14} />
      </button>
      <button
        type="button"
        title="Print A4 page"
        aria-label="Print A4 page"
        onClick={() => printVoucher(kind, id, "a4")}
        className={cn(btn, "text-[10px] font-bold")}
      >
        A4
      </button>
    </span>
  );
}
