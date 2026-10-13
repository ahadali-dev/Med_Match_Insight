"use client";

import type { ReactNode } from "react";
import { useUi } from "./dashboard-provider";

/** A provider's name as a button that opens their profile drawer. */
export function ProviderLink({ id, children }: { id: string; children: ReactNode }) {
  const { openProvider } = useUi();
  return (
    <button
      type="button"
      onClick={() => openProvider(id)}
      className="rounded text-left font-semibold text-ink underline decoration-[#9fb5ab] decoration-dotted underline-offset-4 hover:text-accent"
    >
      {children}
    </button>
  );
}
