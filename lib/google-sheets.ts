import "server-only";
import { JWT } from "google-auth-library";
import { sheetUrl } from "./clients";
import { SheetError } from "./errors";
import { TAB_NAMES, type RawTabs } from "./types";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

let cachedAuth: JWT | undefined;

export function serviceAccountEmail(): string | undefined {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || undefined;
}

export function credentialsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim());
}

function auth(): JWT {
  if (cachedAuth) return cachedAuth;
  const email = serviceAccountEmail();
  // Env vars usually hold the key with literal "\n" sequences and sometimes wrapping quotes.
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new SheetError(
      "missing_credentials",
      "Google credentials are not set. Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY to your environment variables.",
    );
  }
  cachedAuth = new JWT({ email, key, scopes: [READONLY_SCOPE] });
  return cachedAuth;
}

interface ApiErrorShape {
  response?: { status?: number; data?: { error?: { message?: string } } };
  message?: string;
}

function mapError(err: unknown, spreadsheetId: string): SheetError {
  if (err instanceof SheetError) return err;
  const e = err as ApiErrorShape;
  const status = e.response?.status;
  const apiMessage = e.response?.data?.error?.message ?? "";
  console.error("[sheets] request failed", status, apiMessage || e.message);
  if (status === 403 || status === 401) {
    if (/has not been used|is disabled|accessNotConfigured/i.test(apiMessage)) {
      return new SheetError("api", "The Google Sheets API is not enabled for this service account's project. Enable it in Google Cloud Console.");
    }
    return new SheetError(
      "not_shared",
      `The service account cannot open this sheet. Share it with ${serviceAccountEmail() ?? "the service account email"} (Viewer is enough).`,
    );
  }
  if (status === 404) {
    return new SheetError("not_found", `No Google Sheet found with ID "${spreadsheetId}". Check the sheetId for this client.`);
  }
  if (status === 429) {
    return new SheetError("rate_limited", "Google is rate limiting requests. Wait a minute and refresh.");
  }
  if (/invalid_grant|DECODER|PEM|private key/i.test(`${e.message ?? ""} ${apiMessage}`)) {
    return new SheetError("missing_credentials", "The service account key was rejected. Re-copy GOOGLE_PRIVATE_KEY from the JSON key file.");
  }
  return new SheetError("api", "Could not read the Google Sheet. Check the server logs for details.");
}

/** Reads every tab the dashboard needs, in two calls (metadata, then one batchGet). */
export async function fetchRawTabs(spreadsheetId: string): Promise<{ raw: RawTabs; title: string; url: string; tabCount: number }> {
  const client = auth();
  const id = encodeURIComponent(spreadsheetId);
  try {
    const meta = await client.request<{
      properties?: { title?: string };
      spreadsheetUrl?: string;
      sheets?: { properties?: { title?: string } }[];
    }>({
      url: `${API}/${id}?fields=properties.title,spreadsheetUrl,sheets.properties.title`,
      timeout: 15_000,
    });
    const present = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));
    const absent = TAB_NAMES.filter((t) => !present.has(t));
    if (absent.length > 0) {
      throw new SheetError(
        "missing_tab",
        `The sheet is missing the tab${absent.length > 1 ? "s" : ""} ${absent.map((t) => `"${t}"`).join(", ")}. Tab names must match exactly.`,
      );
    }

    const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", majorDimension: "ROWS" });
    for (const t of TAB_NAMES) params.append("ranges", `'${t}'`);
    const values = await client.request<{ valueRanges?: { values?: unknown[][] }[] }>({
      url: `${API}/${id}/values:batchGet?${params.toString()}`,
      timeout: 15_000,
    });

    const raw = {} as RawTabs;
    TAB_NAMES.forEach((t, i) => {
      raw[t] = values.data.valueRanges?.[i]?.values ?? [];
    });
    return {
      raw,
      title: meta.data.properties?.title ?? "Google Sheet",
      url: meta.data.spreadsheetUrl ?? sheetUrl(spreadsheetId),
      tabCount: present.size,
    };
  } catch (err) {
    throw mapError(err, spreadsheetId);
  }
}
