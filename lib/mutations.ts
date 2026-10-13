/**
 * Pure edits on SheetData, used by the editable demo workspace. Every function returns a new
 * object, so React sees the change and the dashboard recomputes from it.
 */
import { addDays, type ISODate } from "./dates";
import type { CredentialingRow, Expiration, OnboardingRow, Provider, Role, SheetData } from "./types";

export type TableKind = "providers" | "credentialing" | "expirations" | "roles" | "onboarding";
type RecordOf<K extends TableKind> = SheetData[K][number];

let counter = 0;
export const newUid = (kind: TableKind) => `${kind}:new-${Date.now().toString(36)}-${counter++}`;

export function updateRecord<K extends TableKind>(data: SheetData, kind: K, uid: string, patch: Partial<RecordOf<K>>): SheetData {
  const rows = (data[kind] as { uid: string }[]).map((r) => (r.uid === uid ? { ...r, ...patch } : r));
  return { ...data, [kind]: rows } as SheetData;
}

export function addRecord<K extends TableKind>(data: SheetData, kind: K, record: RecordOf<K>): SheetData {
  return { ...data, [kind]: [...(data[kind] as unknown[]), record] } as SheetData;
}

export function deleteRecord(data: SheetData, kind: TableKind, uid: string): SheetData {
  if (kind === "providers") {
    const gone = data.providers.find((p) => p.uid === uid);
    if (!gone) return data;
    // Removing a provider removes everything that hangs off it.
    return {
      ...data,
      providers: data.providers.filter((p) => p.uid !== uid),
      credentialing: data.credentialing.filter((r) => r.providerId !== gone.id),
      expirations: data.expirations.filter((r) => r.providerId !== gone.id),
      onboarding: data.onboarding.filter((r) => r.providerId !== gone.id),
    };
  }
  return { ...data, [kind]: (data[kind] as { uid: string }[]).filter((r) => r.uid !== uid) } as SheetData;
}

export function nextProviderId(data: SheetData): string {
  const max = data.providers.reduce((m, p) => Math.max(m, Number(/(\d+)$/.exec(p.id)?.[1] ?? 0)), 0);
  return `P-${String(max + 1).padStart(2, "0")}`;
}

/** Edits the Config tab values. */
export function updateConfig(data: SheetData, patch: Partial<SheetData["config"]>): SheetData {
  return { ...data, config: { ...data.config, ...patch } };
}

/**
 * Finishes the provider's current credentialing step today and opens the next one.
 * After step 4 the provider moves to Onboarding.
 */
export function advanceCredentialing(data: SheetData, providerId: string, today: ISODate): SheetData {
  const rows = data.credentialing.filter((r) => r.providerId === providerId);
  const done = new Set(rows.filter((r) => r.completedDate).map((r) => r.step));
  const step = [1, 2, 3, 4].find((s) => !done.has(s));
  if (!step) return data;

  let next = data;
  const open = rows.find((r) => r.step === step);
  if (open) {
    next = updateRecord(next, "credentialing", open.uid, { completedDate: today < open.startedDate ? open.startedDate : today, waitingOn: "", waitingOnProvider: false });
  } else {
    const row: CredentialingRow = { uid: newUid("credentialing"), providerId, step, startedDate: today, completedDate: today, waitingOn: "", waitingOnProvider: false };
    next = addRecord(next, "credentialing", row);
  }
  if (step < 4) {
    const row: CredentialingRow = { uid: newUid("credentialing"), providerId, step: step + 1, startedDate: today, completedDate: null, waitingOn: "", waitingOnProvider: false };
    next = addRecord(next, "credentialing", row);
  } else {
    const p = next.providers.find((x) => x.id === providerId);
    if (p) next = updateRecord(next, "providers", p.uid, { status: "Onboarding" });
    if (!next.onboarding.some((o) => o.providerId === providerId)) {
      const o: OnboardingRow = { uid: newUid("onboarding"), providerId, startDate: addDays(today, 14), stepsDone: 0, stepsTotal: 8, nextStep: "Badge and EHR login" };
      next = addRecord(next, "onboarding", o);
    }
  }
  return next;
}

/** Puts a provider into credentialing at step 1 (used when adding a provider). */
export function startCredentialing(data: SheetData, providerId: string, today: ISODate): SheetData {
  const p = data.providers.find((x) => x.id === providerId);
  let next = data;
  if (p) next = updateRecord(next, "providers", p.uid, { status: "In credentialing" });
  if (!next.credentialing.some((r) => r.providerId === providerId)) {
    const row: CredentialingRow = { uid: newUid("credentialing"), providerId, step: 1, startedDate: today, completedDate: null, waitingOn: "", waitingOnProvider: false };
    next = addRecord(next, "credentialing", row);
  }
  return next;
}

export type { Provider, Expiration, Role };
