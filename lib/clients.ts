import { SheetError } from "./errors";

export interface ClientConfig {
  /** URL slug, e.g. "riverbend". */
  id: string;
  /** Name shown in the client switcher. */
  name: string;
  /** Google Sheet ID (the long string in the sheet's URL). "local" selects the built-in sample. */
  sheetId: string;
}

export const LOCAL_SHEET_ID = "local";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True when this client has a real Google Sheet behind it (not just the built-in demo). */
export function hasSheet(c: ClientConfig): boolean {
  return c.sheetId !== LOCAL_SHEET_ID;
}

/**
 * One entry per client sheet. Configure with the CLIENTS env var:
 *   CLIENTS=[{"name":"Riverbend Medical Group","sheetId":"1AbC..."},{"name":"Lakeview Surgery Center","sheetId":"1XyZ..."}]
 * For a single client you can instead set SHEET_ID (and optionally CLIENT_NAME).
 */
export function getClients(): ClientConfig[] {
  const raw = process.env.CLIENTS?.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SheetError("no_clients", "The CLIENTS environment variable is not valid JSON. Expected a list like [{\"name\":\"Riverbend\",\"sheetId\":\"...\"}].");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new SheetError("no_clients", "The CLIENTS environment variable must be a non-empty JSON list.");
    }
    const seen = new Set<string>();
    return parsed.map((entry, i) => {
      const e = entry as Partial<ClientConfig>;
      const name = String(e?.name ?? "").trim();
      const sheetId = String(e?.sheetId ?? "").trim();
      if (!name || !sheetId) {
        throw new SheetError("no_clients", `CLIENTS entry ${i + 1} needs both "name" and "sheetId".`);
      }
      let id = slug(String(e.id ?? name)) || `client-${i + 1}`;
      while (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);
      return { id, name, sheetId };
    });
  }

  const single = process.env.SHEET_ID?.trim();
  if (single) {
    const name = process.env.CLIENT_NAME?.trim() || "Client";
    return [{ id: slug(name) || "client", name, sheetId: single }];
  }

  // Nothing configured: run as a self-contained demo workspace.
  return [{ id: "riverbend", name: "Riverbend Medical Group", sheetId: LOCAL_SHEET_ID }];
}

export function findClient(id: string): ClientConfig | undefined {
  return getClients().find((c) => c.id === id);
}

export function sheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit`;
}
