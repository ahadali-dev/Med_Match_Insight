"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { findClient } from "@/lib/clients";
import { describeError } from "@/lib/errors";
import { getSheetData, sheetTag } from "@/lib/get-sheet-data";
import { SHEET_ID_PATTERN } from "@/lib/sheet-id";
import { sheetCookie } from "@/lib/source";
import type { SheetData } from "@/lib/types";

export type SyncResult =
  | { ok: true; data: SheetData; serverTime: string }
  | { ok: false; error: string };

async function load(clientId: string): Promise<SyncResult> {
  try {
    // Only sheets listed in the server's own config can be read, never an ID sent by the browser.
    if (!findClient(clientId)) return { ok: false, error: "Unknown client." };
    const fromCookie = (await cookies()).get(sheetCookie(clientId))?.value ?? "";
    const result = await getSheetData(clientId, SHEET_ID_PATTERN.test(fromCookie) ? fromCookie : "");
    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true, data: result.data, serverTime: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: describeError(err).message };
  }
}

/** Background poll: returns the cached read (at most 60 seconds old). */
export async function syncSheet(clientId: string): Promise<SyncResult> {
  return load(clientId);
}

/** "Refresh now": drops the cached read first so the sheet is read again. */
export async function refreshSheet(clientId: string): Promise<SyncResult> {
  try {
    if (!findClient(clientId)) return { ok: false, error: "Unknown client." };
  } catch (err) {
    return { ok: false, error: describeError(err).message };
  }
  updateTag(sheetTag(clientId));
  return load(clientId);
}
