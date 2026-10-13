"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { formatAge, useActions, useDashboard, useSync, useUi } from "./dashboard-provider";
import { Chip, SampleBadge, cx } from "./ui";
import { displayName, type Dashboard } from "@/lib/metrics";

const ICONS = {
  overview: "M3 12l9-8 9 8M5 10v10h14V10",
  providers: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  credentialing: "M9 12l2 2 4-4M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
  expirations: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  payer: "M3 7h18v10H3zM3 11h18",
  recruiting: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-5-5",
  onboarding: "M5 12h14M13 6l6 6-6 6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
} as const;

const NAV: { label: string; path: string; icon: keyof typeof ICONS; badge?: boolean }[] = [
  { label: "Overview", path: "", icon: "overview" },
  { label: "Providers", path: "/providers", icon: "providers" },
  { label: "Credentialing", path: "/credentialing", icon: "credentialing" },
  { label: "Licences & expirations", path: "/expirations", icon: "expirations", badge: true },
  { label: "Payer enrollment", path: "/payer-enrollment", icon: "payer" },
  { label: "Recruiting", path: "/recruiting", icon: "recruiting" },
  { label: "Onboarding", path: "/onboarding", icon: "onboarding" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

const COLLAPSE_KEY = "mm-sidebar-collapsed";
let collapsedMemory = false;
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(cb: () => void) {
  collapseListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    collapseListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return collapsedMemory;
  }
}
function writeCollapsed(v: boolean) {
  collapsedMemory = v;
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    /* storage blocked: keep it in memory for this visit */
  }
  collapseListeners.forEach((l) => l());
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white"
      >
        MM
      </span>
      {!compact && (
        <div>
          <div className="text-[15px] font-bold leading-tight text-white">Med Match</div>
          <div className="text-xs leading-tight text-sidebar-muted">Client dashboards</div>
        </div>
      )}
      {compact && <span className="sr-only">Med Match client dashboards</span>}
    </div>
  );
}

export function SyncStatus({ onDark = false }: { onDark?: boolean }) {
  const sync = useSync();
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

function SyncDot() {
  const sync = useSync();
  const bad = sync.error !== null;
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cx("inline-block size-3 rounded-full", bad ? "bg-[#f5c26b]" : "bg-mint")} />
      <span className="sr-only">
        {bad ? "Connection problem" : "Connected"}, synced {formatAge(sync.ageMin)}
      </span>
    </span>
  );
}

function DataSourceCard() {
  const { data, mode, liveAvailable, liveHint } = useDashboard();
  const sync = useSync();
  const actions = useActions();
  const { source, warnings } = data;
  const seg = (active: boolean) =>
    cx(
      "min-h-9 flex-1 rounded-md px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50",
      active ? "bg-white text-sidebar" : "text-sidebar-text hover:bg-sidebar-active",
    );
  return (
    <section aria-labelledby="source-heading" className="mt-auto flex flex-col gap-2.5 rounded-xl border border-sidebar-line bg-sidebar-raised p-3.5">
      <h2 id="source-heading" className="text-xs font-semibold uppercase tracking-[0.04em] text-sidebar-muted">
        Data source
      </h2>
      <div role="group" aria-label="Choose data source" className="flex gap-1 rounded-lg bg-sidebar p-1">
        <button type="button" aria-pressed={mode === "demo"} onClick={() => mode !== "demo" && actions.setSource("demo")} className={seg(mode === "demo")}>
          Demo data
        </button>
        <button
          type="button"
          aria-pressed={mode === "live"}
          disabled={!liveAvailable}
          title={liveAvailable ? undefined : liveHint}
          onClick={() => mode !== "live" && actions.setSource("live")}
          className={seg(mode === "live")}
        >
          Google Sheet
        </button>
      </div>
      {!liveAvailable && <p className="text-xs leading-normal text-sidebar-muted">{liveHint}</p>}

      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7fd1a8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M4 9h16M4 15h16M10 3v18" />
        </svg>
        <span className="min-w-0 break-words">{source.title}</span>
      </div>

      {mode === "demo" ? (
        <>
          <p className="text-xs leading-normal text-sidebar-text">Everything is editable. Changes are saved in this browser only.</p>
          <button
            type="button"
            onClick={() => actions.resetDemo()}
            className="min-h-9 rounded-md border border-sidebar-line px-3 text-xs font-semibold text-white hover:bg-sidebar-active"
          >
            Reset demo data
          </button>
        </>
      ) : (
        <>
          <p className="text-xs leading-normal text-sidebar-text">
            Google Sheet · {source.tabCount} tabs
            <br />
            Read-only. Reads the sheet every time the page opens, plus every 5 minutes
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
          {source.url && (
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex min-h-8 items-center text-[13px] font-semibold text-white underline hover:text-white">
              Open the sheet<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </>
      )}
    </section>
  );
}

function GlobalSearch() {
  const { data } = useDashboard();
  const { openProvider } = useUi();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  useOutsideClose(open, searchRef, () => setOpen(false));

  // "/" jumps to search, like most web apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? data.providers
        .filter((p) => `${p.name} ${p.id} ${p.specialty} ${p.location} ${p.credential} ${p.status}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];
  const pick = (id: string) => {
    openProvider(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <label htmlFor="global-search" className="sr-only">
        Find a provider
      </label>
      <div className="relative">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5a53" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-5-5" />
        </svg>
        <input
          ref={inputRef}
          id="global-search"
          type="search"
          autoComplete="off"
          value={query}
          placeholder="Find a provider…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) pick(results[0].id);
          }}
          className="min-h-10 w-full rounded-lg border border-line bg-white py-2 pl-9 pr-9 text-sm text-ink placeholder:text-muted"
        />
        <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-muted sm:block">
          /
        </kbd>
      </div>
      {open && q !== "" && (
        <ul aria-label="Matching providers" className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">No providers match &ldquo;{query}&rdquo;.</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => pick(p.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-page">
                  <span>
                    <span className="font-semibold text-ink">{displayName(p)}</span>
                    <span className="block text-xs text-muted">
                      {p.specialty} · {p.location}
                    </span>
                  </span>
                  <Chip tone={p.status === "Ready" ? "good" : "warn"}>{p.status}</Chip>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Where an attention item should take you. */
export function attentionHref(clientId: string, link: Dashboard["attention"][number]["link"]): string {
  return "providerId" in link ? `/${clientId}/providers/${encodeURIComponent(link.providerId)}` : `/${clientId}/${link.page}`;
}

/** Closes a popover when the pointer goes down outside it or Escape is pressed. */
function useOutsideClose(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}

function Notifications() {
  const { dash, client } = useDashboard();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(open, wrapRef, () => setOpen(false));
  const n = dash.attention.length;
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-lg border border-line bg-white text-ink hover:bg-page"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
        </svg>
        <span className="sr-only">Needs attention: {n} {n === 1 ? "item" : "items"}</span>
        {n > 0 && (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-fg px-1 text-center font-mono text-[11px] leading-5 text-white">
            {n}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-full z-40 mt-1.5 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-line bg-white p-2 shadow-lg">
          <h2 className="px-2 py-1.5 text-sm font-semibold">Needs attention</h2>
          {n === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">All clear.</p>
          ) : (
            <ul className="max-h-[min(26rem,calc(100dvh-13rem))] overflow-y-auto">
              {dash.attention.map((a) => (
                <li key={a.id}>
                  <Link
                    href={attentionHref(client.id, a.link)}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-2 text-ink no-underline hover:bg-page hover:text-ink"
                  >
                    <Chip tone={a.tone === "urgent" || a.tone === "overdue" ? "bad" : "warn"}>{a.tag}</Chip>
                    <span className="mt-1 block text-sm font-medium leading-snug">{a.title}</span>
                    <span className="block text-xs text-muted">{a.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/${client.id}`} onClick={() => setOpen(false)} className="mt-1 block rounded-lg border-t border-line px-2 py-2.5 text-sm font-semibold">
            Open the overview
          </Link>
        </div>
      )}
    </div>
  );
}

function Topbar() {
  const { mode, data } = useDashboard();
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white/85 px-4 py-2.5 backdrop-blur sm:px-7 lg:sticky lg:top-0 lg:z-20">
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2.5">
        {mode === "demo" ? <Chip tone="warn">Demo workspace</Chip> : <Chip tone="good">Live · {data.source.title}</Chip>}
        <Notifications />
        <span title="Demo user" className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
          <span aria-hidden="true">DU</span>
          <span className="sr-only">Demo user</span>
        </span>
      </div>
    </div>
  );
}

function Toaster() {
  const { toasts, dismissToast } = useUi();
  const actions = useActions();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl bg-sidebar px-4 py-3 text-sm text-white shadow-xl">
          <span>{t.message}</span>
          <span className="flex shrink-0 items-center gap-1">
            {t.canUndo && (
              <button
                type="button"
                onClick={() => {
                  actions.undo();
                  dismissToast(t.id);
                }}
                className="min-h-9 rounded-md px-2.5 font-semibold text-mint underline hover:bg-sidebar-active"
              >
                Undo
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="min-h-9 min-w-9 rounded-md hover:bg-sidebar-active">
              <span aria-hidden="true">×</span>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function Announcer() {
  const { announcement } = useSync();
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { client, clients, data, dash, showSampleBadge, mode } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const menuId = useId();
  const base = `/${client.id}`;
  const subPath = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const badge = dash.kpis.expiring30;

  return (
    <div
      className={cx(
        "min-h-dvh bg-page lg:grid lg:transition-[grid-template-columns] lg:duration-200",
        collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[288px_minmax(0,1fr)]",
      )}
    >
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
        <div className={cx("hidden items-center lg:flex", collapsed ? "flex-col gap-3" : "justify-between gap-2 px-1.5")}>
          <Logo compact={collapsed} />
          <button
            type="button"
            onClick={() => writeCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-sidebar-line bg-sidebar-raised text-white hover:bg-sidebar-active"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? "M13 6l6 6-6 6M5 6l6 6-6 6" : "M11 6l-6 6 6 6M19 6l-6 6 6 6"} />
            </svg>
          </button>
        </div>

        <div className={cx("px-1.5", collapsed && "lg:hidden")}>
          {clients.length > 1 ? (
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
          ) : (
            <div className="flex flex-col gap-1.5 text-xs text-sidebar-muted">
              Client
              <div className="flex min-h-11 items-center rounded-md border border-sidebar-line bg-sidebar-raised px-3 text-sm font-medium text-white">{client.name}</div>
            </div>
          )}
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
                    title={collapsed ? item.label : undefined}
                    className={cx(
                      "relative flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm no-underline",
                      collapsed && "lg:justify-center",
                      active ? "bg-sidebar-active font-semibold text-white" : "font-medium text-sidebar-text hover:bg-sidebar-raised hover:text-white",
                    )}
                  >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d={ICONS[item.icon]} />
                    </svg>
                    <span className={cx("flex-1", collapsed && "lg:sr-only")}>{item.label}</span>
                    {item.badge && badge > 0 && (
                      <span
                        className={cx(
                          "rounded-full bg-red-fg px-[7px] py-px font-mono text-xs text-white",
                          collapsed && "lg:absolute lg:right-0.5 lg:top-0.5 lg:px-1 lg:text-[10px]",
                        )}
                      >
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

        <div className={collapsed ? "lg:hidden" : "contents"}>
          <DataSourceCard />
        </div>
        {collapsed && (
          <div className="mt-auto hidden justify-center lg:flex" title="Data source status">
            <SyncDot />
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col gap-5 px-4 pb-10 pt-6 outline-none sm:px-7 sm:pt-7">
          {children}
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-8 text-xs text-muted sm:px-7">
          <span>
            {mode === "demo"
              ? "Demo workspace: edit anything, changes stay in this browser. Switch to Google Sheet in the sidebar for live data."
              : `Live from ${data.source.title} (Google Sheet). Edit the sheet and this page updates on the next refresh.`}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            Prepared by Med Match Solutions
            {showSampleBadge && <SampleBadge />}
          </span>
        </footer>
      </div>

      <Announcer />
      <Toaster />
    </div>
  );
}
