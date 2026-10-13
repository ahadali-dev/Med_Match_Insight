"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { refreshSheet, syncSheet } from "@/app/actions";
import { todayISO } from "@/lib/dates";
import { buildDashboard, NO_FILTERS, type Dashboard, type Filters } from "@/lib/metrics";
import type { SheetData } from "@/lib/types";

/** The sheet is re-read in the background this often. */
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
  sync: {
    /** Minutes since the last successful read. */
    ageMin: number;
    error: string | null;
    busy: boolean;
    refreshNow: () => void;
    announcement: string;
  };
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}

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
  children,
}: {
  client: ClientSummary;
  clients: ClientSummary[];
  initialData: SheetData;
  initialServerTime: string;
  showSampleBadge: boolean;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState({ data: initialData, serverTime: initialServerTime });
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ageMin, setAgeMin] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  // Client-clock time of the last good read. Only ever touched from effects and handlers.
  const syncedAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const clientId = client.id;

  const run = useCallback(
    async (mode: "poll" | "refresh") => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (mode === "refresh") {
        setBusy(true);
        setAnnouncement("");
      }
      try {
        const res = mode === "refresh" ? await refreshSheet(clientId) : await syncSheet(clientId);
        if (res.ok) {
          setSnapshot({ data: res.data, serverTime: res.serverTime });
          setError(null);
          syncedAt.current = Date.now();
          setAgeMin(0);
          if (mode === "refresh") setAnnouncement("Data refreshed from the Google Sheet.");
        } else {
          setError(res.error);
          if (mode === "refresh") setAnnouncement(`Refresh failed. ${res.error}`);
        }
      } catch {
        setError("Could not reach the server. Check your connection.");
        if (mode === "refresh") setAnnouncement("Refresh failed. Could not reach the server.");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
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
  }, [run]);

  const today = todayISO(new Date(snapshot.serverTime));
  const dash = useMemo(() => buildDashboard(snapshot.data, filters, today), [snapshot.data, filters, today]);

  const value: DashboardContextValue = {
    client,
    clients,
    data: snapshot.data,
    dash,
    filters,
    setFilters,
    showSampleBadge,
    sync: { ageMin, error, busy, refreshNow: () => void run("refresh"), announcement },
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
