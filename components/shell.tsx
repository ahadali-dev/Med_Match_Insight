"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { formatAge, useDashboard } from "./dashboard-provider";
import { SampleBadge, cx } from "./ui";

const ICONS = {
  overview: "M3 12l9-8 9 8M5 10v10h14V10",
  providers: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  credentialing: "M9 12l2 2 4-4M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
  expirations: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  payer: "M3 7h18v10H3zM3 11h18",
  recruiting: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-5-5",
  onboarding: "M5 12h14M13 6l6 6-6 6",
} as const;

const NAV: { label: string; path: string; icon: keyof typeof ICONS; badge?: boolean }[] = [
  { label: "Overview", path: "", icon: "overview" },
  { label: "Providers", path: "/providers", icon: "providers" },
  { label: "Credentialing", path: "/credentialing", icon: "credentialing" },
  { label: "Licences & expirations", path: "/expirations", icon: "expirations", badge: true },
  { label: "Payer enrollment", path: "/payer-enrollment", icon: "payer" },
  { label: "Recruiting", path: "/recruiting", icon: "recruiting" },
  { label: "Onboarding", path: "/onboarding", icon: "onboarding" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white"
      >
        MM
      </span>
      <div>
        <div className="text-[15px] font-bold leading-tight text-white">Med Match</div>
        <div className="text-xs leading-tight text-sidebar-muted">Client dashboards</div>
      </div>
    </div>
  );
}

export function SyncStatus({ onDark = false }: { onDark?: boolean }) {
  const { sync } = useDashboard();
  const bad = sync.error !== null;
  return (
    <div
      className={cx(
        "flex items-center gap-1.5 text-xs font-semibold",
        onDark ? (bad ? "text-[#f5c26b]" : "text-mint") : bad ? "text-amber" : "text-accent",
      )}
    >
      <span
        aria-hidden="true"
        className={cx("inline-block size-2 shrink-0 rounded-full", onDark ? (bad ? "bg-[#f5c26b]" : "bg-mint") : bad ? "bg-amber" : "bg-accent")}
      />
      <span>
        {bad ? "Connection problem" : "Connected"} · synced {formatAge(sync.ageMin)}
      </span>
    </div>
  );
}

function DataSourceCard() {
  const { data, sync } = useDashboard();
  const { source, warnings } = data;
  return (
    <section aria-labelledby="source-heading" className="mt-auto flex flex-col gap-2 rounded-[10px] border border-sidebar-line bg-sidebar-raised p-3.5">
      <h2 id="source-heading" className="text-xs font-semibold uppercase tracking-[0.04em] text-sidebar-muted">
        Data source
      </h2>
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7fd1a8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M4 9h16M4 15h16M10 3v18" />
        </svg>
        <span className="min-w-0 break-words">{source.title}</span>
      </div>
      <p className="text-xs leading-normal text-sidebar-text">
        {source.kind === "google" ? "Google Sheet" : "Built-in sample, no sheet connected"} · {source.tabCount} tabs
        <br />
        Reads the sheet every time the page opens, plus every 5 minutes
      </p>
      <SyncStatus onDark />
      {sync.error && (
        <p role="alert" className="text-xs leading-normal text-[#f5c26b]">
          {sync.error}
        </p>
      )}
      {warnings.length > 0 && (
        <details className="text-xs text-sidebar-text">
          <summary className="cursor-pointer font-semibold text-white">
            {warnings.length} sheet {warnings.length === 1 ? "note" : "notes"}
          </summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {warnings.slice(0, 8).map((w) => (
              <li key={w}>{w}</li>
            ))}
            {warnings.length > 8 && <li>and {warnings.length - 8} more</li>}
          </ul>
        </details>
      )}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-8 items-center text-[13px] font-semibold text-white underline hover:text-white"
        >
          Open the sheet<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="flex min-h-8 items-center text-[13px] text-sidebar-text">No sheet to open (local sample)</span>
      )}
    </section>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { client, clients, data, dash, showSampleBadge, sync } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const base = `/${client.id}`;
  const subPath = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const badge = dash.kpis.expiring30;

  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Skip to main content
      </a>

      {/* Mobile top bar */}
      <div className="on-dark sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-2.5 lg:hidden">
        <Logo />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 items-center gap-2 rounded-md border border-sidebar-line bg-sidebar-raised px-3.5 text-sm font-semibold text-white"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <aside
        id={menuId}
        className={cx(
          "on-dark flex-col gap-5 bg-sidebar px-4 py-5 text-sidebar-text",
          "lg:sticky lg:top-0 lg:flex lg:h-dvh lg:overflow-y-auto",
          open ? "flex" : "hidden",
        )}
      >
        <div className="hidden px-1.5 lg:block">
          <Logo />
        </div>

        <div className="px-1.5">
          <label htmlFor="client-switcher" className="flex flex-col gap-1.5 text-xs text-sidebar-muted">
            Client
            <select
              id="client-switcher"
              value={client.id}
              onChange={(e) => {
                setOpen(false);
                router.push(`/${e.target.value}${subPath}`);
              }}
              className="min-h-11 rounded-md border border-sidebar-line bg-sidebar-raised px-2.5 py-2 text-sm text-white"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav aria-label="Main">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const href = `${base}${item.path}`;
              const active = item.path === "" ? pathname === base : pathname.startsWith(href);
              return (
                <li key={item.label}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cx(
                      "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm no-underline",
                      active ? "bg-sidebar-active font-semibold text-white" : "font-medium text-sidebar-text hover:bg-sidebar-raised hover:text-white",
                    )}
                  >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d={ICONS[item.icon]} />
                    </svg>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && badge > 0 && (
                      <span className="rounded-full bg-red-fg px-[7px] py-px font-mono text-xs text-white">
                        {badge}
                        <span className="sr-only"> {badge === 1 ? "item" : "items"} expired or expiring within 30 days</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <DataSourceCard />
      </aside>

      <div className="flex min-w-0 flex-col">
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col gap-5 px-4 pb-10 pt-6 outline-none sm:px-7 sm:pt-7">
          {children}
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-8 text-xs text-muted sm:px-7">
          <span>
            Live from {data.source.title}{data.source.kind === "google" ? " (Google Sheet)" : ""}. Edit the sheet and this page updates on the next refresh.
          </span>
          <span className="flex flex-wrap items-center gap-2">
            Prepared by Med Match Solutions
            {showSampleBadge && <SampleBadge />}
          </span>
        </footer>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {sync.announcement}
      </div>
    </div>
  );
}
