"use client";

import { useDashboard, useSync } from "./dashboard-provider";
import { SyncStatus } from "./shell";
import { SampleBadge, cx } from "./ui";

const SELECT =
  "min-h-11 rounded-md border border-[#c3cec9] bg-white px-3 py-2 text-sm text-ink";

export function PageHeader({ title, crumb }: { title: string; crumb: string }) {
  const { dash, filters, setFilters, showSampleBadge } = useDashboard();
  const sync = useSync();

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span>{dash.clientName}</span>
          <span aria-hidden="true">/</span>
          <span>{crumb}</span>
          {showSampleBadge && <SampleBadge />}
        </div>
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
      </div>

      <div className="flex flex-wrap items-end gap-2.5" role="group" aria-label="Filters and refresh">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Location
          <select
            className={SELECT}
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          >
            <option value="">All locations</option>
            {dash.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Specialty
          <select
            className={SELECT}
            value={filters.specialty}
            onChange={(e) => setFilters({ ...filters, specialty: e.target.value })}
          >
            <option value="">All specialties</option>
            {dash.specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={sync.refreshNow}
          disabled={sync.busy}
          aria-busy={sync.busy}
          className={cx(
            "flex min-h-11 items-center gap-2 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold text-ink",
            "hover:bg-page disabled:cursor-wait disabled:opacity-70",
          )}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={sync.busy ? "motion-safe:animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
          </svg>
          {sync.busy ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      {/* On phones the sidebar is collapsed, so repeat the sync status here. */}
      <div className="w-full lg:hidden">
        <SyncStatus />
      </div>
    </header>
  );
}
