"use client";

import { useId, useState } from "react";
import { cx } from "./ui";

export type EditType = "text" | "number" | "date" | "select" | "combo";

export interface EditSpec<T> {
  type: EditType;
  /** Current value as the input should show it. */
  get: (row: T) => string;
  set: (row: T, value: string) => void;
  options?: string[];
  min?: number;
  /** Date and text fields may be cleared. */
  clearable?: boolean;
}

export const INPUT =
  "min-h-10 w-full rounded-md border border-[#c3cec9] bg-white px-2 py-1.5 text-sm text-ink placeholder:text-muted";

/** One in-place input. Saves on change (select, date) or on blur / Enter (text, number). */
export function EditCell({
  type,
  value,
  options = [],
  label,
  min,
  clearable,
  onCommit,
  className,
}: {
  type: EditType;
  value: string;
  options?: string[];
  label: string;
  min?: number;
  clearable?: boolean;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const listId = useId();

  if (type === "select") {
    return (
      <select aria-label={label} value={value} onChange={(e) => onCommit(e.target.value)} className={cx(INPUT, className)}>
        {!options.includes(value) && <option value={value}>{value || "–"}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (type === "date") {
    return (
      <input
        aria-label={label}
        type="date"
        defaultValue={value}
        key={value}
        onChange={(e) => {
          if (e.target.value || clearable) onCommit(e.target.value);
        }}
        className={cx(INPUT, "min-w-[8.5rem]", className)}
      />
    );
  }

  const commit = (raw: string) => {
    const v = raw.trim();
    if (v === value) return;
    if (type === "number") {
      const n = Number(v);
      if (v === "" || !Number.isFinite(n) || n < (min ?? 0)) return;
      onCommit(String(Math.round(n)));
    } else if (v !== "" || clearable) {
      onCommit(v);
    }
  };

  return (
    <>
      <input
        aria-label={label}
        type={type === "number" ? "number" : "text"}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? (min ?? 0) : undefined}
        list={type === "combo" ? listId : undefined}
        defaultValue={value}
        key={value}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={cx(INPUT, type === "number" && "w-20", className)}
      />
      {type === "combo" && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  );
}

export interface FormField {
  key: string;
  label: string;
  type: EditType;
  options?: string[];
  required?: boolean;
  initial?: string;
}

/** A small collapsible "add a row" form. */
export function AddForm({
  buttonLabel,
  title,
  fields,
  onSubmit,
}: {
  buttonLabel: string;
  title: string;
  fields: FormField[];
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.initial ?? (f.type === "select" ? (f.options?.[0] ?? "") : "")]));
  const [values, setValues] = useState<Record<string, string>>(blank);
  const [seq, setSeq] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-fit items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
      >
        <span aria-hidden="true">{open ? "−" : "+"}</span>
        {buttonLabel}
      </button>
      {open && (
        <form
          id={panelId}
          aria-label={title}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
            setValues(blank());
            setSeq((n) => n + 1);
            setOpen(false);
          }}
          className="grid gap-3 rounded-xl border border-line bg-page p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {fields.map((f) => (
            <label key={`${seq}-${f.key}`} className="flex flex-col gap-1 text-xs font-medium text-muted">
              {f.label}
              {f.required && <span className="sr-only"> (required)</span>}
              {f.type === "select" ? (
                <select
                  className={INPUT}
                  required={f.required}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                >
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    className={INPUT}
                    required={f.required}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    min={f.type === "number" ? 0 : undefined}
                    list={f.type === "combo" ? `${panelId}-${f.key}` : undefined}
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                  {f.type === "combo" && (
                    <datalist id={`${panelId}-${f.key}`}>
                      {f.options?.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  )}
                </>
              )}
            </label>
          ))}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className="min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark">
              Save
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold text-ink hover:bg-page"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
