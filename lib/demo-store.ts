/**
 * Browser-side storage for the editable demo workspace. Edits live in localStorage (per client)
 * and never leave the browser. The server only supplies the pristine sample as the starting point.
 */
import type { SheetData } from "./types";

const VERSION = 1;
const key = (clientId: string) => `mm-demo-${VERSION}-${clientId}`;

const cache = new Map<string, SheetData | null>();
const listeners = new Set<() => void>();

export function subscribeDemo(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("mm-demo-")) {
      cache.clear();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns the saved workspace, or null if nothing was edited yet. The reference is stable between changes. */
export function getDemoSnapshot(clientId: string): SheetData | null {
  if (cache.has(clientId)) return cache.get(clientId) ?? null;
  let value: SheetData | null = null;
  try {
    const raw = localStorage.getItem(key(clientId));
    if (raw) {
      const parsed = JSON.parse(raw) as SheetData;
      if (Array.isArray(parsed.providers) && parsed.config) value = parsed;
    }
  } catch {
    value = null;
  }
  cache.set(clientId, value);
  return value;
}

export function saveDemo(clientId: string, data: SheetData | null) {
  cache.set(clientId, data);
  try {
    if (data) localStorage.setItem(key(clientId), JSON.stringify(data));
    else localStorage.removeItem(key(clientId));
  } catch {
    /* storage full or blocked: the edit still shows for this visit */
  }
  listeners.forEach((l) => l());
}
