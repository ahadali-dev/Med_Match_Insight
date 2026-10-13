import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { LOCAL_SHEET_ID, findClient, sheetUrl } from "./clients";
import { todayISO } from "./dates";
import { describeError, type SheetErrorCode } from "./errors";
import { fetchRawTabs } from "./google-sheets";
import { parseSheet } from "./parse-sheet";
import { SEED_SHEET_TITLE, buildSeedTabs } from "./seed-data";
import { TAB_NAMES, type SheetData } from "./types";

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

    const fetchedAt = new Date().toISOString();

    if (client.sheetId === LOCAL_SHEET_ID) {
      // Opt-in development fallback (USE_LOCAL_SAMPLE=1). Same parser, no Google call.
      const source = { kind: "local" as const, title: `${SEED_SHEET_TITLE} (local sample)`, url: null, tabCount: TAB_NAMES.length };
      return { ok: true, data: parseSheet(buildSeedTabs(todayISO()), source, fetchedAt) };
    }

    const { raw, title, url, tabCount } = await fetchRawTabs(client.sheetId);
    const source = { kind: "google" as const, title, url: url || sheetUrl(client.sheetId), tabCount };
    return { ok: true, data: parseSheet(raw, source, fetchedAt) };
  } catch (err) {
    return { ok: false, ...describeError(err) };
  }
}
