/**
 * Builds the sample "Riverbend tracker" Google Sheet with fake data.
 *
 *   npm run seed                 create a new sheet and share it with SEED_SHARE_WITH
 *   npm run seed -- --dry-run    print what would be written, no Google calls
 *
 * Needs GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY (same as the app; read from .env.local).
 * If creating a file as the service account fails (some Google Workspaces block it), make an empty
 * sheet yourself, share it with the service account as Editor, and set SEED_SPREADSHEET_ID.
 */
import { JWT } from "google-auth-library";
import { todayISO } from "../lib/dates";
import { SEED_HEADERS, SEED_SHEET_TITLE, buildSeedTabs } from "../lib/seed-data";
import { TAB_NAMES, type TabName } from "../lib/types";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* file not present */
  }
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const DATE_COLUMNS: Partial<Record<TabName, string[]>> = {
  Credentialing: ["started_date", "completed_date"],
  Expirations: ["expiry_date"],
  Roles: ["opened_date"],
  Onboarding: ["start_date"],
};
const DROPDOWNS: Partial<Record<TabName, Record<string, string[]>>> = {
  Providers: { credential: ["MD", "RN", "CRNA", "NP"], status: ["Ready", "In credentialing", "Onboarding"] },
  Credentialing: { step: ["1", "2", "3", "4"], waiting_on_provider: ["yes", "no"] },
};

async function main() {
  const tabs = buildSeedTabs(todayISO());

  if (process.argv.includes("--dry-run")) {
    for (const t of TAB_NAMES) {
      console.log(`\n== ${t} (${tabs[t].length - 1} rows)`);
      for (const row of tabs[t].slice(0, 4)) console.log(row.join("\t"));
    }
    return;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY first (see .env.example).");
  const auth = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  });
  const call = async <T>(url: string, method: "GET" | "POST", data?: unknown): Promise<T> => (await auth.request<T>({ url, method, data })).data;

  let id = process.env.SEED_SPREADSHEET_ID?.trim();
  if (id) {
    const meta = await call<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`${SHEETS}/${id}?fields=sheets.properties`, "GET");
    const have = new Set(meta.sheets.map((s) => s.properties.title));
    const requests = TAB_NAMES.filter((t) => !have.has(t)).map((title) => ({ addSheet: { properties: { title } } }));
    requests.push({ updateSpreadsheetProperties: { properties: { title: SEED_SHEET_TITLE }, fields: "title" } } as never);
    await call(`${SHEETS}/${id}:batchUpdate`, "POST", { requests });
    await call(`${SHEETS}/${id}/values:batchClear`, "POST", { ranges: TAB_NAMES.map((t) => `'${t}'`) });
  } else {
    const created = await call<{ spreadsheetId: string }>(SHEETS, "POST", {
      properties: { title: SEED_SHEET_TITLE },
      sheets: TAB_NAMES.map((title) => ({ properties: { title } })),
    });
    id = created.spreadsheetId;
  }

  await call(`${SHEETS}/${id}/values:batchUpdate`, "POST", {
    valueInputOption: "USER_ENTERED",
    data: TAB_NAMES.map((t) => ({ range: `'${t}'!A1`, values: tabs[t] })),
  });

  // Formatting: bold frozen header, date cells, dropdowns, tidy column widths.
  const meta = await call<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`${SHEETS}/${id}?fields=sheets.properties`, "GET");
  const sheetIds = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const requests: unknown[] = [];
  const unused = meta.sheets.find((s) => !(TAB_NAMES as readonly string[]).includes(s.properties.title) && /^Sheet\d+$/.test(s.properties.title));
  if (unused) requests.push({ deleteSheet: { sheetId: unused.properties.sheetId } });
  for (const t of TAB_NAMES) {
    const sheetId = sheetIds.get(t) as number;
    const headers = SEED_HEADERS[t] as readonly string[];
    requests.push(
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.94, blue: 0.92 } } }, fields: "userEnteredFormat(textFormat,backgroundColor)" } },
      { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length } } },
    );
    for (const col of DATE_COLUMNS[t] ?? []) {
      const c = headers.indexOf(col);
      requests.push({ repeatCell: { range: { sheetId, startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } });
    }
    for (const [col, values] of Object.entries(DROPDOWNS[t] ?? {})) {
      const c = headers.indexOf(col);
      requests.push({ setDataValidation: { range: { sheetId, startRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: values.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false } } });
    }
  }
  await call(`${SHEETS}/${id}:batchUpdate`, "POST", { requests });

  const shareWith = process.env.SEED_SHARE_WITH?.trim();
  if (shareWith && !process.env.SEED_SPREADSHEET_ID) {
    await call(`${DRIVE}/${id}/permissions?sendNotificationEmail=false`, "POST", { type: "user", role: "writer", emailAddress: shareWith });
  }

  console.log(`\nSeeded "${SEED_SHEET_TITLE}" with ${tabs.Providers.length - 1} providers.`);
  console.log(`Open it:  https://docs.google.com/spreadsheets/d/${id}/edit`);
  console.log(`Add it:   CLIENTS=[{"name":"Riverbend Medical Group","sheetId":"${id}"}]`);
  if (!shareWith && !process.env.SEED_SPREADSHEET_ID) console.log("Tip: set SEED_SHARE_WITH=you@example.com to be able to open the new sheet yourself.");
}

main().catch((err) => {
  console.error(err?.response?.data?.error?.message ?? err.message ?? err);
  process.exit(1);
});
