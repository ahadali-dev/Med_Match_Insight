"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { getClients, hasSheet } from "@/lib/clients";
import { describeError, type SheetErrorCode } from "@/lib/errors";
import { credentialsConfigured, fetchRawTabs, serviceAccountEmail } from "@/lib/google-sheets";
import { extractSheetId } from "@/lib/sheet-id";
import { parseSheet } from "@/lib/parse-sheet";

/**
 * Admin tools: check a Google Sheet before putting it into the CLIENTS setting.
 * Gated by ADMIN_PASSCODE. Without it, tools are open only outside production (local development).
 * Nothing here is stored: it reads, validates and reports.
 */

type Gate = { ok: true } | { ok: false; reason: "locked" | "wrong" };

async function gate(code: string): Promise<Gate> {
  const expected = process.env.ADMIN_PASSCODE?.trim();
  if (!expected) return process.env.NODE_ENV === "production" ? { ok: false, reason: "locked" } : { ok: true };
  const a = createHash("sha256").update(code ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  if (timingSafeEqual(a, b)) return { ok: true };
  await new Promise((r) => setTimeout(r, 600)); // slow down guessing
  return { ok: false, reason: "wrong" };
}

export interface AdminClient {
  id: string;
  name: string;
  sheetId: string;
  hasSheet: boolean;
}

export type UnlockResult =
  | { ok: false; reason: "locked" | "wrong" }
  | { ok: true; serviceAccount: string | null; credentials: boolean; clients: AdminClient[]; clientsError: string | null };

export async function unlockAdmin(code: string): Promise<UnlockResult> {
  const g = await gate(code);
  if (!g.ok) return g;
  let clients: AdminClient[] = [];
  let clientsError: string | null = null;
  try {
    clients = getClients().map((c) => ({ id: c.id, name: c.name, sheetId: c.sheetId, hasSheet: hasSheet(c) }));
  } catch (err) {
    clientsError = describeError(err).message;
  }
  return { ok: true, serviceAccount: serviceAccountEmail() ?? null, credentials: credentialsConfigured(), clients, clientsError };
}

export type SheetCheck =
  | { ok: false; reason?: "locked" | "wrong"; code?: SheetErrorCode | "bad_input"; message: string }
  | {
      ok: true;
      sheetId: string;
      title: string;
      tabCount: number;
      clientName: string;
      targetDays: number;
      counts: { providers: number; credentialing: number; expirations: number; roles: number; onboarding: number };
      warnings: string[];
    };

async function inspect(sheetId: string): Promise<SheetCheck> {
  try {
    const { raw, title, tabCount } = await fetchRawTabs(sheetId);
    const data = parseSheet(raw, { kind: "google", title, url: null, tabCount }, new Date().toISOString());
    return {
      ok: true,
      sheetId,
      title,
      tabCount,
      clientName: data.config.clientName,
      targetDays: data.config.targetDays,
      counts: {
        providers: data.providers.length,
        credentialing: data.credentialing.length,
        expirations: data.expirations.length,
        roles: data.roles.length,
        onboarding: data.onboarding.length,
      },
      warnings: data.warnings.slice(0, 12),
    };
  } catch (err) {
    const { code, message } = describeError(err);
    return { ok: false, code, message };
  }
}

export async function testSheet(code: string, input: string): Promise<SheetCheck> {
  const g = await gate(code);
  if (!g.ok) return { ok: false, reason: g.reason, message: g.reason === "wrong" ? "Wrong admin passcode." : "Admin tools are locked." };
  const id = extractSheetId(input);
  if (!id) return { ok: false, code: "bad_input", message: "That doesn't look like a Google Sheets link or ID. Paste the full URL from your browser's address bar." };
  return inspect(id);
}

export interface ClientCheck {
  id: string;
  name: string;
  result: SheetCheck;
}

export async function checkConfiguredClients(code: string): Promise<{ ok: true; results: ClientCheck[] } | { ok: false; message: string }> {
  const g = await gate(code);
  if (!g.ok) return { ok: false, message: g.reason === "wrong" ? "Wrong admin passcode." : "Admin tools are locked." };
  try {
    const clients = getClients().filter(hasSheet);
    const results = await Promise.all(clients.map(async (c) => ({ id: c.id, name: c.name, result: await inspect(c.sheetId) })));
    return { ok: true, results };
  } catch (err) {
    return { ok: false, message: describeError(err).message };
  }
}
