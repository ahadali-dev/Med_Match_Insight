"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { refreshSheet, syncSheet } from "@/app/actions";
import { todayISO } from "@/lib/dates";
import { getDemoSnapshot, saveDemo, subscribeDemo } from "@/lib/demo-store";
import { buildDashboard, NO_FILTERS, type Dashboard, type Filters } from "@/lib/metrics";
import {
  addRecord,
  advanceCredentialing,
  moveCredentialing,
  deleteRecord,
  newUid,
  nextProviderId,
  startCredentialing,
  updateConfig,
  updateRecord,
  type TableKind,
} from "@/lib/mutations";
import { sheetCookie, sourceCookie, type SourceMode } from "@/lib/source";
import type { Provider, SheetData } from "@/lib/types";

/** The sheet is re-read in the background this often (live mode). */
export const POLL_MS = 5 * 60 * 1000;

export interface ClientSummary {
  id: string;
  name: string;
}

interface DashboardContextValue {
  client: ClientSummary;
  clients: ClientSummary[];
  data: SheetData;
  dash: Dashboard;
  filters: Filters;
  setFilters: (f: Filters) => void;
  showSampleBadge: boolean;
  mode: SourceMode;
  /** A real sheet is configured for this client and credentials exist, so Live can be chosen. */
  liveAvailable: boolean;
  /** Live needs a sheetId in CLIENTS; says why Live is unavailable. */
  liveHint: string;
  /** The live sheet was connected with a pasted link (not server configuration). */
  linkedSheet: boolean;
}

/** Changes every few seconds, so it lives apart from the data: only the status widgets listen to it. */
interface SyncContextValue {
  /** Minutes since the last successful read. */
  ageMin: number;
  error: string | null;
  busy: boolean;
  refreshNow: () => void;
  announcement: string;
}

export interface Toast {
  id: number;
  message: string;
  canUndo: boolean;
}

interface UiContextValue {
  /** True in the demo workspace, where rows can be edited, added and deleted. */
  canEdit: boolean;
  /** Opens the provider's full detail page. */
  openProvider: (id: string) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

interface ActionsContextValue {
  update: <K extends TableKind>(kind: K, uid: string, patch: Partial<SheetData[K][number]>, message?: string) => void;
  add: <K extends TableKind>(kind: K, record: Omit<SheetData[K][number], "uid">, message?: string) => void;
  /** Adds a provider and (optionally) starts their credentialing file. */
  addProvider: (p: Omit<Provider, "uid" | "id" | "status">, startCredentialing: boolean) => void;
  remove: (kind: TableKind, uid: string, message?: string) => void;
  advance: (providerId: string) => void;
  /** Moves a credentialing file to step 1-4, or 5 = finished. */
  move: (providerId: string, target: number, label: string) => void;
  setConfig: (patch: Partial<SheetData["config"]>) => void;
  resetDemo: () => void;
  undo: () => void;
  setSource: (mode: SourceMode) => void;
  /** Connects a link-shared Google Sheet by ID and switches to live data. */
  connectSheet: (sheetId: string) => void;
  disconnectSheet: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);
const SyncContext = createContext<SyncContextValue | null>(null);
const UiContext = createContext<UiContextValue | null>(null);
const ActionsContext = createContext<ActionsContextValue | null>(null);

function need<T>(ctx: T | null, name: string): T {
  if (!ctx) throw new Error(`${name} must be used inside <DashboardProvider>`);
  return ctx;
}
export const useDashboard = () => need(useContext(DashboardContext), "useDashboard");
export const useSync = () => need(useContext(SyncContext), "useSync");
export const useUi = () => need(useContext(UiContext), "useUi");
export const useActions = () => need(useContext(ActionsContext), "useActions");

export function formatAge(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ago`;
}

export function DashboardProvider({
  client,
  clients,
  initialData,
  initialServerTime,
  showSampleBadge,
  mode,
  liveAvailable,
  liveHint,
  linkedSheet,
  children,
}: {
  client: ClientSummary;
  clients: ClientSummary[];
  initialData: SheetData;
  initialServerTime: string;
  showSampleBadge: boolean;
  mode: SourceMode;
  liveAvailable: boolean;
  liveHint: string;
  linkedSheet: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const clientId = client.id;

  // ---- live mode: server snapshot, polled
  const [snapshot, setSnapshot] = useState({ data: initialData, serverTime: initialServerTime });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ageMin, setAgeMin] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const syncedAt = useRef<number | null>(null);
  const inFlight = useRef(false);

  // ---- demo mode: edits kept in the browser on top of the pristine sample
  const stored = useSyncExternalStore(
    subscribeDemo,
    () => getDemoSnapshot(clientId),
    () => null,
  );
  const demoData = stored ?? initialData;
  const data = mode === "live" ? snapshot.data : demoData;

  // ---- UI state
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const openProvider = useCallback((id: string) => router.push(`/${clientId}/providers/${encodeURIComponent(id)}`), [router, clientId]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const history = useRef<SheetData[]>([]);

  const pushToast = useCallback((message: string, canUndo: boolean) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, canUndo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const today = todayISO(new Date(mode === "live" ? snapshot.serverTime : initialServerTime));

  // ---- live sync
  const run = useCallback(
    async (kind: "poll" | "refresh") => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (kind === "refresh") {
        setBusy(true);
        setAnnouncement("");
      }
      try {
        const res = kind === "refresh" ? await refreshSheet(clientId) : await syncSheet(clientId);
        if (res.ok) {
          setSnapshot({ data: res.data, serverTime: res.serverTime });
          setError(null);
          syncedAt.current = Date.now();
          setAgeMin(0);
          if (kind === "refresh") setAnnouncement("Data refreshed from the Google Sheet.");
        } else {
          setError(res.error);
          if (kind === "refresh") setAnnouncement(`Refresh failed. ${res.error}`);
        }
      } catch {
        setError("Could not reach the server. Check your connection.");
        if (kind === "refresh") setAnnouncement("Refresh failed. Could not reach the server.");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
    if (mode !== "live") return;
    if (syncedAt.current === null) syncedAt.current = Date.now();
    const poll = setInterval(() => void run("poll"), POLL_MS);
    const tick = setInterval(() => {
      const last = syncedAt.current ?? Date.now();
      setAgeMin(Math.floor((Date.now() - last) / 60_000));
    }, 15_000);
    // Browsers slow timers in background tabs, so catch up as soon as the tab is visible again.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const last = syncedAt.current ?? Date.now();
      if (Date.now() - last >= POLL_MS) void run("poll");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [run, mode]);

  // ---- derived numbers
  const dash = useMemo(() => buildDashboard(data, filters, today), [data, filters, today]);

  // ---- edit actions (demo only)
  const mutate = useCallback(
    (fn: (d: SheetData) => SheetData, message?: string) => {
      if (mode !== "demo") return;
      const current = getDemoSnapshot(clientId) ?? initialData;
      const next = fn(current);
      if (next === current) return;
      history.current = [...history.current.slice(-19), current];
      saveDemo(clientId, next);
      if (message) pushToast(message, true);
    },
    [mode, clientId, initialData, pushToast],
  );

  const actions = useMemo<ActionsContextValue>(
    () => ({
      update: (kind, uid, patch, message) => mutate((d) => updateRecord(d, kind, uid, patch as never), message),
      add: (kind, record, message) =>
        mutate((d) => addRecord(d, kind, { ...record, uid: newUid(kind) } as never), message ?? "Row added."),
      addProvider: (p, start) =>
        mutate((d) => {
          const id = nextProviderId(d);
          const next = addRecord(d, "providers", { ...p, uid: newUid("providers"), id, status: start ? "In credentialing" : "Ready" });
          return start ? startCredentialing(next, id, today) : next;
        }, `${p.name} added.`),
      remove: (kind, uid, message) => mutate((d) => deleteRecord(d, kind, uid), message ?? "Row deleted."),
      advance: (providerId) => mutate((d) => advanceCredentialing(d, providerId, today), "Credentialing step completed."),
      move: (providerId, target, label) => mutate((d) => moveCredentialing(d, providerId, target, today), label),
      setConfig: (patch) => mutate((d) => updateConfig(d, patch), "Settings saved."),
      resetDemo: () => {
        history.current = [];
        saveDemo(clientId, null);
        pushToast("Demo data reset to the original sample.", false);
      },
      undo: () => {
        const prev = history.current[history.current.length - 1];
        if (!prev) return;
        history.current = history.current.slice(0, -1);
        saveDemo(clientId, prev);
        pushToast("Change undone.", false);
      },
      connectSheet: (sheetId) => {
        const year = "max-age=31536000; path=/; SameSite=Lax";
        document.cookie = `${sheetCookie(clientId)}=${encodeURIComponent(sheetId)}; ${year}`;
        document.cookie = `${sourceCookie(clientId)}=live; ${year}`;
        router.refresh();
      },
      disconnectSheet: () => {
        document.cookie = `${sheetCookie(clientId)}=; max-age=0; path=/; SameSite=Lax`;
        document.cookie = `${sourceCookie(clientId)}=demo; max-age=31536000; path=/; SameSite=Lax`;
        router.refresh();
      },
      setSource: (m) => {
        document.cookie = `${sourceCookie(clientId)}=${m}; path=/; max-age=31536000; SameSite=Lax`;
        router.refresh();
      },
    }),
    [mutate, clientId, today, pushToast, router],
  );

  const dashboardValue = useMemo<DashboardContextValue>(
    () => ({ client, clients, data, dash, filters, setFilters, showSampleBadge, mode, liveAvailable, liveHint, linkedSheet }),
    [client, clients, data, dash, filters, showSampleBadge, mode, liveAvailable, liveHint, linkedSheet],
  );
  const refreshNow = useCallback(() => void run("refresh"), [run]);
  const sync = useMemo<SyncContextValue>(
    () => ({ ageMin, error, busy, refreshNow, announcement }),
    [ageMin, error, busy, refreshNow, announcement],
  );
  const canEdit = mode === "demo";
  const ui = useMemo<UiContextValue>(
    () => ({ canEdit, openProvider, toasts, dismissToast }),
    [canEdit, openProvider, toasts, dismissToast],
  );

  return (
    <DashboardContext.Provider value={dashboardValue}>
      <SyncContext.Provider value={sync}>
        <UiContext.Provider value={ui}>
          <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
        </UiContext.Provider>
      </SyncContext.Provider>
    </DashboardContext.Provider>
  );
}
