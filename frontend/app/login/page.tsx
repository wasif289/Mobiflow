"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useSession, type User } from "@/lib/session";

/* ------------------------------ icons ------------------------------ */
type IconProps = { className?: string };

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconShop({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <path d="M4.5 4h15L21 9.5H3L4.5 4Z" />
      <path d="M4 9.5V20h16V9.5" />
      <path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    </svg>
  );
}

function IconUser({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function IconLock({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconEye({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconEyeOff({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.7" />
      <path d="M6.3 7.9A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.5-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function IconAlert({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16.2h.01" />
    </svg>
  );
}

function IconArrow({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconCheck({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

function Spinner({ className }: IconProps) {
  return (
    <svg
      {...svgProps}
      className={`animate-spin ${className ?? ""}`}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" className="opacity-30" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

/* ------------------------------ page ------------------------------ */
export default function LoginPage() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [tenant, setTenant] = useState(useSession.getState().tenant);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: User }>("/auth/login", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          username: f.get("username"),
          password: f.get("password"),
        }),
      });
      signIn("cookie", tenant, r.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-border bg-bg py-3 pl-11 pr-3 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px] opacity-40" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-16">
        {/* ---------------- brand / device showcase ---------------- */}
        <section className="hidden lg:flex lg:flex-col lg:justify-center">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white shadow-lg">
              <IconShop className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold leading-tight">MobiFlow</p>
              <p className="text-xs text-muted">Shop OS for mobile retailers</p>
            </div>
          </div>

          <h2 className="mt-10 max-w-md text-3xl font-bold tracking-tight xl:text-4xl">
            Run your whole phone shop from one screen.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Stock, IMEI tracking, repairs and daily cash — synced live across
            the counter and the back office.
          </p>

          <ul className="mt-7 space-y-3 text-sm">
            {[
              "Know what is in stock before the customer asks",
              "Track every repair from intake to pickup",
              "Close the day with cash and card reconciled",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted">{t}</span>
              </li>
            ))}
          </ul>

          {/* phone mock */}
          <div className="mt-10 w-[268px]">
            <div className="relative rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl">
              <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-border" />
              <div className="space-y-3 rounded-[2rem] bg-bg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted">
                      Today
                    </p>
                    <p className="text-lg font-bold">₨ 148,300</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                    +12%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-card p-2.5">
                    <p className="text-[10px] text-muted">Repairs due</p>
                    <p className="text-sm font-semibold">7</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-2.5">
                    <p className="text-[10px] text-muted">Low stock</p>
                    <p className="text-sm font-semibold">3</p>
                  </div>
                </div>
                {["iPhone 13 · 128GB", "Galaxy A54 · 256GB"].map((item, i) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"
                  >
                    <span
                      className={`h-7 w-7 rounded-lg ${i === 0 ? "bg-primary/20" : "bg-primary/10"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{item}</p>
                      <p className="text-[10px] text-muted">
                        {i === 0 ? "In stock · 4" : "In stock · 9"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- login card ---------------- */}
        <section className="mx-auto w-full max-w-sm lg:max-w-md">
          {/* compact brand for mobile */}
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white shadow-lg">
              <IconShop className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">MobiFlow</p>
              <p className="text-xs text-muted">Shop OS for mobile retailers</p>
            </div>
          </div>

          <form
            onSubmit={submit}
            noValidate
            className="rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8"
          >
            <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">
              Sign in to open your shop dashboard.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex gap-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              >
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium">{error.message}</p>
                  {error.problem.trace_id && error.problem.status >= 500 && (
                    <p className="mt-1 break-all text-xs opacity-80">
                      Reference: {error.problem.trace_id}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {/* shop code */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                  Shop code
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <IconShop className="h-4.5 w-4.5" />
                  </span>
                  <input
                    className={input}
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="organization"
                    placeholder="mobi-store-01"
                    required
                    disabled={busy}
                  />
                </div>
              </label>

              {/* username */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                  Username
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <IconUser className="h-4.5 w-4.5" />
                  </span>
                  <input
                    name="username"
                    className={input}
                    autoComplete="username"
                    placeholder="you@shop"
                    required
                    disabled={busy}
                    aria-invalid={!!error?.field("username")}
                  />
                </div>
                {error?.field("username") && (
                  <span className="mt-1.5 block text-xs text-danger">
                    {error.field("username")}
                  </span>
                )}
              </label>

              {/* password */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                  Password
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    <IconLock className="h-4.5 w-4.5" />
                  </span>
                  <input
                    name="password"
                    type={showPw ? "text" : "password"}
                    className={`${input} pr-11`}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-fg"
                  >
                    {showPw ? (
                      <IconEyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <IconEye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
                {error?.field("password") && (
                  <span className="mt-1.5 block text-xs text-danger">
                    {error.field("password")}
                  </span>
                )}
              </label>
            </div>

            <button
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <IconArrow className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-widest text-muted">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="text-center text-sm text-muted">
              New shop?{" "}
              <a
                href="/register"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Start free trial
              </a>
            </p>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted">
            Secure sign-in · Your shop data stays isolated
          </p>
        </section>
      </div>
    </main>
  );
}
