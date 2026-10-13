"use server";

import { describeError, SheetError, type SheetErrorCode } from "@/lib/errors";
import { parseSheet } from "@/lib/parse-sheet";
import { fetchPublicTabs } from "@/lib/public-sheet";
import { extractSheetId } from "@/lib/sheet-id";

export type LinkCheck =
  | { ok: false; message: string; code?: SheetErrorCode | "bad_input" }
  | {
      ok: true;
      sheetId: string;
      clientName: string;
      targetDays: number;
      counts: { providers: number; credentialing: number; expirations: number; roles: number; onboarding: number };
      warnings: string[];
    };

/**
 * "Connect a Google Sheet": checks a sheet that is shared as "Anyone with the link".
 * Reads only; nothing is stored. Only docs.google.com is contacted, and only with a validated ID.
 */
export async function checkSheetLink(input: string): Promise<LinkCheck> {
  const id = extractSheetId(input);
  if (!id) return { ok: false, code: "bad_input", message: "That doesn't look like a Google Sheets link. Copy the whole link from your browser's address bar." };
  try {
    const { raw, tabCount } = await fetchPublicTabs(id);
    const data = parseSheet(raw, { kind: "google", title: "Google Sheet", url: null, tabCount }, new Date().toISOString());
    return {
      ok: true,
      sheetId: id,
      clientName: data.config.clientName,
      targetDays: data.config.targetDays,
      counts: {
        providers: data.providers.length,
        credentialing: data.credentialing.length,
        expirations: data.expirations.length,
        roles: data.roles.length,
        onboarding: data.onboarding.length,
      },
      warnings: data.warnings.slice(0, 10),
    };
  } catch (err) {
    const { code, message } = describeError(err);
    const hint = err instanceof SheetError && code === "bad_schema" ? " Check that the tab exists and is named exactly like that." : "";
    return { ok: false, code, message: message + hint };
  }
}
