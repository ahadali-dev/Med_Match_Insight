"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useUi } from "./dashboard-provider";
import { EditCell, FormDialog, type EditSpec, type FormField } from "./edit-cells";
import { Modal } from "./modal";
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
  /** A dropdown or input shown right in the row (demo workspace only), e.g. Status. */
  quick?: EditSpec<T>;
}

export interface RowActions<T> {
  /** Replaces the built-in details dialog (e.g. open the provider profile instead). */
  details?: (row: T) => void;
  /** Fields for the Edit dialog; omit to hide the Edit button. */
  edit?: {
    fields: FormField[];
    values: (row: T) => Record<string, string>;
    submit: (row: T, values: Record<string, string>) => void;
  };
  /** Omit to hide the Delete button. */
  remove?: (row: T) => void;
  /** When set, the built-in details dialog offers to open this provider's profile. */
  providerId?: (row: T) => string | undefined;
}

const FIELD = "min-h-10 rounded-md border border-[#c3cec9] bg-white px-2.5 py-1.5 text-sm text-ink";
const ACTION = "min-h-9 rounded-md border border-[#c3cec9] bg-white px-2.5 text-xs font-semibold text-ink hover:bg-page";
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
  actions,
  rowLabel,
  exportName,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty: string;
  minWidth?: number;
  controls?: boolean;
  pageSizes?: number[];
  /** Adds an Actions column: Details always, Edit and Delete in the demo workspace. */
  actions?: RowActions<T>;
  /** Names a row for screen readers ("Delete Dr. Singh"). */
  rowLabel?: (row: T) => string;
  /** Base file name for the CSV export button. */
  exportName?: string;
}) {
  const uid = useId();
  const { canEdit, openProvider } = useUi();
  const [editRow, setEditRow] = useState<T | null>(null);
  const [detailRow, setDetailRow] = useState<T | null>(null);
  const showActions = Boolean(controls && actions);
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

  const exportCsv = () => {
    const cols = columns.filter((c) => c.value);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => esc(c.header)).join(","), ...processed.map((r) => cols.map((c) => esc(c.value?.(r))).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName ?? caption.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <button type="button" className={cx(BTN, "ml-auto")} onClick={exportCsv} disabled={processed.length === 0}>
            Export CSV
          </button>
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
                {showActions && (
                  <th scope="col" className="px-2 py-2 text-right font-semibold">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, ri) => (
                <tr key={rowKey(row, ri)} className="border-t border-line-soft align-top">
                  {columns.map((c, i) => (
                    <td key={c.header} className={cx("py-2.5 text-body", i === 0 ? "pr-2" : "px-2", c.align === "right" && "text-right", c.className)}>
                      {canEdit && c.quick ? (
                        <EditCell
                          type={c.quick.type}
                          value={c.quick.get(row)}
                          options={c.quick.options}
                          min={c.quick.min}
                          clearable={c.quick.clearable}
                          label={`${c.header}${rowLabel ? ` for ${rowLabel(row)}` : ""}`}
                          onCommit={(v) => c.quick?.set(row, v)}
                        />
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                  {showActions && actions && (
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className={ACTION} aria-label={`Details for ${rowLabel ? rowLabel(row) : "row"}`} onClick={() => (actions.details ? actions.details(row) : setDetailRow(row))}>
                          Details
                        </button>
                        {canEdit && actions.edit && (
                          <button type="button" className={ACTION} aria-label={`Edit ${rowLabel ? rowLabel(row) : "row"}`} onClick={() => setEditRow(row)}>
                            Edit
                          </button>
                        )}
                        {canEdit && actions.remove && (
                          <button type="button" className={cx(ACTION, "border-[#e4b4ae] text-red hover:bg-red-bg")} aria-label={`Delete ${rowLabel ? rowLabel(row) : "row"}`} onClick={() => actions.remove?.(row)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
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

      {editRow && actions?.edit && (
        <FormDialog
          title={`Edit ${rowLabel ? rowLabel(editRow) : "row"}`}
          fields={actions.edit.fields}
          initial={actions.edit.values(editRow)}
          onSubmit={(v) => actions.edit?.submit(editRow, v)}
          onClose={() => setEditRow(null)}
        />
      )}
      {detailRow && (
        <Modal title={rowLabel ? rowLabel(detailRow) : "Details"} onClose={() => setDetailRow(null)}>
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {columns.map((c) => (
              <div key={c.header} className="min-w-0">
                <dt className="text-xs font-medium text-muted">{c.header}</dt>
                <dd className="mt-0.5 text-sm text-ink">{c.cell(detailRow)}</dd>
              </div>
            ))}
          </dl>
          {actions?.providerId?.(detailRow) && (
            <button
              type="button"
              className="mt-5 min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
              onClick={() => {
                const id = actions.providerId?.(detailRow);
                setDetailRow(null);
                if (id) openProvider(id);
              }}
            >
              Open provider profile
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
