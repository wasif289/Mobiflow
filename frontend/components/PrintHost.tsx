"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import VoucherSlip, {
  type Shop,
  type SlipData,
} from "@/components/VoucherSlip";
import { api, ApiError } from "@/lib/api";
import { usePrintSlip } from "@/lib/printslip";

type Loaded = { nonce: number; data?: SlipData; shop?: Shop; error?: string };
const FALLBACK_SHOP: Shop = {
  name: "MobiFlow",
  phone: null,
  address: null,
  footer: null,
};

/**
 * Mounted once in AppShell. When something calls printVoucher(...) it loads the slip, puts it on the page
 * (hidden on screen, the only thing the printer sees), opens the print dialog, and removes it again afterwards.
 */
export default function PrintHost() {
  const job = usePrintSlip((s) => s.job);
  const finish = usePrintSlip((s) => s.finish);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  /* 1. a new print job: fetch the voucher and the shop's name / address / footer */
  useEffect(() => {
    if (!job) return;
    let alive = true;
    Promise.all([
      api<SlipData>(
        job.kind === "expense" ? `/expenses/${job.id}` : `/vouchers/${job.id}`,
      ),
      api<Shop>("/shop").catch(() => FALLBACK_SHOP), // a missing shop name should never stop a print
    ])
      .then(([data, shop]) => {
        if (alive) setLoaded({ nonce: job.nonce, data, shop });
      })
      .catch((e) => {
        if (alive)
          setLoaded({
            nonce: job.nonce,
            error:
              e instanceof ApiError ? e.message : "Could not load the slip.",
          });
      });
    return () => {
      alive = false;
    };
  }, [job]);

  const ready = !!job && loaded?.nonce === job.nonce; // the loaded data belongs to the current job
  const error = ready ? loaded?.error : undefined;

  /* 2. slip is on the page: print it, and clean up when the print dialog closes */
  useEffect(() => {
    if (!ready || !loaded?.data) return;
    const t = setTimeout(() => window.print(), 150); // a moment for the slip to be drawn
    window.addEventListener("afterprint", finish, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", finish);
    };
  }, [ready, loaded, finish]);

  /* 3. an error message disappears by itself */
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(finish, 4000);
    return () => clearTimeout(t);
  }, [error, finish]);

  if (!job) return null;
  const thermal = job.size === "thermal";
  return createPortal(
    <>
      {/* on screen the slip is hidden. When printing: hide the whole app (so a long list never adds blank pages) and tell the printer which paper to use */}
      <style>{`.print-host{display:none}@media print{html,body{background:#fff !important}body>:not(.print-host){display:none !important}.print-host{display:block}@page{size:${thermal ? "80mm auto" : "A4"};margin:${thermal ? "3mm" : "10mm"}}}`}</style>
      {!ready && (
        <div
          role="status"
          className="no-print fixed bottom-4 right-4 z-[90] rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-lg"
        >
          Preparing slip…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="no-print fixed bottom-4 right-4 z-[90] rounded-lg border border-danger/40 bg-card px-4 py-2 text-sm text-danger shadow-lg"
        >
          {error}
        </div>
      )}
      {ready && loaded?.data && loaded.shop && (
        <div className="print-host">
          <div id="print-area" className="bg-white text-black">
            <VoucherSlip
              data={loaded.data}
              shop={loaded.shop}
              size={job.size}
            />
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
