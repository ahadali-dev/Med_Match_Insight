import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({ title, aside, children, className, as: Tag = "section", headingId }: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  headingId?: string;
}) {
  return (
    <Tag
      className={cx("min-w-0 rounded-[10px] border border-line bg-card p-5", className)}
      {...(title && headingId ? { "aria-labelledby": headingId } : {})}
    >
      {title && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id={headingId} className="text-[17px] font-semibold">
            {title}
          </h2>
          {aside && <div className="text-xs text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function SampleBadge() {
  return (
    <span className="inline-block rounded bg-amber-bg px-2 py-0.5 text-xs font-semibold text-amber-fg">Sample data</span>
  );
}

const CHIP_TONES = {
  neutral: "bg-info-bg text-info-fg",
  good: "bg-info-bg text-info-fg",
  warn: "bg-amber-bg text-amber-fg",
  bad: "bg-red-bg text-red-fg",
} as const;

export function Chip({ tone = "neutral", children }: { tone?: keyof typeof CHIP_TONES; children: ReactNode }) {
  return (
    <span className={cx("inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold", CHIP_TONES[tone])}>
      {children}
    </span>
  );
}

export function ProgressBar({ pct, tone = "good", label }: { pct: number; tone?: "good" | "warn"; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-1.5 rounded-[3px] bg-track"
    >
      <div
        className={cx("h-1.5 rounded-[3px]", tone === "warn" ? "bg-amber" : "bg-accent")}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono font-semibold", className)}>{children}</span>;
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  className?: string;
}

/** A plain, keyboard-scrollable table with a real caption for screen readers. */
export function DataTable<T>({ caption, columns, rows, rowKey, empty, minWidth = 560 }: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty: string;
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption} (scrollable)`}>
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            {columns.map((c, i) => (
              <th
                key={c.header}
                scope="col"
                className={cx("py-2 font-semibold", i === 0 ? "pr-2" : "px-2", c.align === "right" && "text-right", c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
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
  );
}
