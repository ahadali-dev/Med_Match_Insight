import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { findClient, hasSheet, sheetUrl } from "./clients";
import { describeError, type SheetErrorCode } from "./errors";
import { fetchRawTabs } from "./google-sheets";
import { parseSheet } from "./parse-sheet";
import type { SheetData } from "./types";

/**
 * Errors are returned, not thrown: an Error thrown inside a cached function loses its class on the
 * way out, and we want the specific, fixable message ("share the sheet with ...") on screen.
 */
export type SheetResult = { ok: true; data: SheetData } | { ok: false; code: SheetErrorCode; message: string };

export const sheetTag = (clientId: string) => `sheet:${clientId}`;

/**
 * Reads one client's Google Sheet. The result is cached for at most 60 seconds:
 * fresh for 30s, then served while a background refresh runs, and never older than 60s.
 * "Refresh now" expires the entry early through updateTag (see app/actions.ts).
 */
export async function getSheetData(clientId: string): Promise<SheetResult> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 30, expire: 60 });
  cacheTag(sheetTag(clientId));

  try {
    const client = findClient(clientId);
    if (!client) return { ok: false, code: "unknown_client", message: `Unknown client "${clientId}".` };
    if (!hasSheet(client)) return { ok: false, code: "not_found", message: "This client has no Google Sheet configured. Add its sheetId to CLIENTS." };

    const fetchedAt = new Date().toISOString();
    const { raw, title, url, tabCount } = await fetchRawTabs(client.sheetId);
    const source = { kind: "google" as const, title, url: url || sheetUrl(client.sheetId), tabCount };
    return { ok: true, data: parseSheet(raw, source, fetchedAt) };
  } catch (err) {
    return { ok: false, ...describeError(err) };
  }
}
