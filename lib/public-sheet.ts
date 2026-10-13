import "server-only";
import { SheetError } from "./errors";
import { TAB_NAMES, type RawTabs } from "./types";

/**
 * Reads a Google Sheet that is shared as "Anyone with the link can view", with no credentials.
 * Only docs.google.com is ever contacted and the sheet ID is validated first.
 */
import { SHEET_ID_PATTERN } from "./sheet-id";
const MAX_BYTES = 4_000_000;

/** Minimal RFC 4180 CSV parser (quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Overridable so tests can point at a local stand-in; defaults to Google. */
const DOCS_BASE = () => process.env.GOOGLE_DOCS_BASE ?? "https://docs.google.com";

async function fetchTab(id: string, tab: string): Promise<string[][]> {
  const url = `${DOCS_BASE()}/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { Accept: "text/csv" } });
  } catch {
    throw new SheetError("api", "Could not reach Google Sheets. Check your internet connection and try again.");
  }
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 404) throw new SheetError("not_found", "No Google Sheet found for that link. Check that you copied the whole link.");
  if (!res.ok || !type.includes("csv")) {
    throw new SheetError(
      "not_shared",
      "The sheet is private. In Google Sheets click Share, then under General access choose “Anyone with the link” (Viewer), and try again.",
    );
  }
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new SheetError("api", "That sheet is too large for the quick connection.");
  return parseCsv(text);
}

export async function fetchPublicTabs(id: string): Promise<{ raw: RawTabs; tabCount: number }> {
  if (!SHEET_ID_PATTERN.test(id)) throw new SheetError("not_found", "That doesn't look like a Google Sheets link.");
  const grids = await Promise.all(TAB_NAMES.map((t) => fetchTab(id, t)));
  const raw = {} as RawTabs;
  TAB_NAMES.forEach((t, i) => {
    raw[t] = grids[i];
  });
  return { raw, tabCount: TAB_NAMES.length };
}
