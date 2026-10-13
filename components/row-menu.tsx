"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: "details" | "edit" | "delete";
}

const ICON_PATHS = {
  details: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  delete: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5",
} as const;

/** A "⋮" button that opens a small menu. The menu is portalled so a scrolling table can't clip it. */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = pos !== null;

  const close = (refocus = true) => {
    setPos(null);
    if (refocus) btnRef.current?.focus();
  };

  const toggle = () => {
    if (open) return close(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const need = items.length * 40 + 16;
    const below = window.innerHeight - r.bottom;
    setPos({ right: Math.max(8, window.innerWidth - r.right), ...(below >= need ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) });
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPos(null);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus({ preventScroll: true });
      } else if (e.key === "Tab") {
        setPos(null);
      }
    };
    const away = (e: Event) => {
      // Moving focus inside the menu can scroll; only a scroll elsewhere should close it.
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setPos(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className="flex size-10 items-center justify-center rounded-lg border border-transparent text-body hover:border-[#c3cec9] hover:bg-page aria-expanded:border-[#c3cec9] aria-expanded:bg-page"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            style={{ right: pos.right, top: pos.top, bottom: pos.bottom }}
            className="fixed z-[60] w-44 rounded-xl border border-line bg-white p-1 shadow-xl"
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close(false);
                  it.onSelect();
                }}
                className={cx(
                  "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium",
                  it.danger ? "text-red hover:bg-red-bg focus:bg-red-bg" : "text-ink hover:bg-page focus:bg-page",
                )}
              >
                {it.icon && (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICON_PATHS[it.icon]} />
                  </svg>
                )}
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
