"use client";
import { useEffect, useState } from "react";

export default function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller)
              setWaiting(w);
          });
        });
      });
    navigator.serviceWorker.addEventListener("controllerchange", () =>
      window.location.reload(),
    );
  }, []);
  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-xl"
    >
      A new version is ready.
      <button
        className="ml-auto font-semibold text-primary"
        onClick={() => waiting.postMessage("SKIP_WAITING")}
      >
        Update
      </button>
    </div>
  );
}
