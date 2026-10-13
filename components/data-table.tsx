"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { cx } from "./ui";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
  /** Plain value used for search, sorting and the column filter. Omit to make the column display-only. */
  value?: (row: T) => string | number | null;
  /** Adds a dropdown listing this column's distinct values. */
  filter?: boolean;
}

const FIELD = "min-h-10 rounded-md border border-[#c3cec9] bg-white px-2.5 py-1.5 text-sm text-ink";
const BTN =
  "min-h-10 min-w-10 rounded-md border border-[#c3cec9] bg-white px-3 text-sm font-semibold text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-50";

function compare(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Table with search, per-column filters, click-to-sort headers and pagination.
 * Pass `controls={false}` for a small embedded table that should just list its rows.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  minWidth = 560,
  controls = true,
  pageSizes = [10, 25, 50],
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty: string;
  minWidth?: number;
  controls?: boolean;
  pageSizes?: number[];
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizes[0]);

  const filterOptions = useMemo(
    () =>
      columns.map((c) =>
        c.filter && c.value
          ? [...new Set(rows.map((r) => String(c.value?.(r) ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b))
          : [],
      ),
    [columns, rows],
  );

  const processed = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      for (const [idx, want] of Object.entries(filters)) {
        if (want && String(columns[+idx].value?.(r) ?? "") !== want) return false;
      }
      if (!q) return true;
      return columns.some((c) => c.value && String(c.value(r) ?? "").toLowerCase().includes(q));
    });
    if (sort) {
      const get = columns[sort.col].value;
      if (get) {
        const sign = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => sign * compare(get(a), get(b)));
      }
    }
    return out;
  }, [rows, columns, query, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = controls ? processed.slice(current * pageSize, (current + 1) * pageSize) : processed;
  const active = query !== "" || Object.values(filters).some(Boolean);
  const hasFilters = filterOptions.some((o) => o.length > 0);

  const toggleSort = (col: number) => {
    setPage(0);
    setSort((s) => (s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null));
  };

  return (
    <div className="flex flex-col gap-3">
      {controls && (
        <div className="flex flex-wrap items-end gap-2.5" role="search" aria-label={`Search and filter: ${caption}`}>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-muted sm:max-w-xs" htmlFor={`${uid}-q`}>
            Search
            <input
              id={`${uid}-q`}
              type="search"
              value={query}
              placeholder="Search this table"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              className={FIELD}
            />
          </label>
          {hasFilters &&
            columns.map((c, i) =>
              filterOptions[i].length > 0 ? (
                <label key={c.header} className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {c.header}
                  <select
                    className={FIELD}
                    value={filters[i] ?? ""}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, [i]: e.target.value }));
                      setPage(0);
                    }}
                  >
                    <option value="">All</option>
                    {filterOptions[i].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null,
            )}
          {active && (
            <button
              type="button"
              className={BTN}
              onClick={() => {
                setQuery("");
                setFilters({});
                setPage(0);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {processed.length === 0 ? (
        <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">
          {active ? "Nothing matches your search or filters." : empty}
        </p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption} (scrollable)`}>
          <table className="w-full border-collapse text-sm" style={{ minWidth }}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                {columns.map((c, i) => {
                  const sorted = sort?.col === i ? sort.dir : null;
                  return (
                    <th
                      key={c.header}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cx("py-2 font-semibold", i === 0 ? "pr-2" : "px-2", c.align === "right" && "text-right", c.className)}
                    >
                      {controls && c.value ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(i)}
                          className={cx("inline-flex min-h-8 items-center gap-1 rounded font-semibold hover:text-ink", c.align === "right" && "flex-row-reverse")}
                        >
                          {c.header}
                          <span aria-hidden="true" className="text-[10px]">
                            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}
                          </span>
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, ri) => (
                <tr key={rowKey(row, ri)} className="border-t border-line-soft align-top">
                  {columns.map((c, i) => (
                    <td key={c.header} className={cx("py-2.5 text-body", i === 0 ? "pr-2" : "px-2", c.align === "right" && "text-right", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {controls && processed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-body">
          <p role="status" aria-live="polite">
            Showing {current * pageSize + 1}–{Math.min((current + 1) * pageSize, processed.length)} of {processed.length}
            {processed.length !== rows.length && ` (filtered from ${rows.length})`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              Rows per page
              <select
                className={FIELD}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                {pageSizes.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <nav aria-label={`${caption} pages`} className="flex items-center gap-2">
              <button type="button" className={BTN} disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </button>
              <span className="whitespace-nowrap text-xs text-muted">
                Page {current + 1} of {pageCount}
              </span>
              <button type="button" className={BTN} disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
                Next
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
