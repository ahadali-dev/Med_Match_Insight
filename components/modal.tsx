"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** A centred dialog built on the native <dialog> element (focus trap, Escape and backdrop handled by the browser). */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(600px,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-card p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="min-h-9 shrink-0 rounded-md border border-[#c3cec9] px-3 text-sm font-semibold hover:bg-page">
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
