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

function completeStep(data: SheetData, providerId: string, step: number, today: ISODate): SheetData {
  const row = data.credentialing.find((r) => r.providerId === providerId && r.step === step);
  if (row) {
    return updateRecord(data, "credentialing", row.uid, {
      completedDate: today < row.startedDate ? row.startedDate : today,
      waitingOn: "",
      waitingOnProvider: false,
    });
  }
  const fresh: CredentialingRow = { uid: newUid("credentialing"), providerId, step, startedDate: today, completedDate: today, waitingOn: "", waitingOnProvider: false };
  return addRecord(data, "credentialing", fresh);
}

/** Step the file is on: first step without a completed date, or 5 when all four are done. */
export function currentStepOf(data: SheetData, providerId: string): number {
  const done = new Set(data.credentialing.filter((r) => r.providerId === providerId && r.completedDate).map((r) => r.step));
  return [1, 2, 3, 4].find((s) => !done.has(s)) ?? 5;
}

/**
 * Moves a provider's credentialing file to `target` (1 to 4 = that step, 5 = finished).
 * Moving forward completes the steps in between today. Moving back reopens the target step and
 * drops the later steps. Finishing moves the provider to Onboarding.
 */
export function moveCredentialing(data: SheetData, providerId: string, target: number, today: ISODate): SheetData {
  const current = currentStepOf(data, providerId);
  if (target === current || target < 1 || target > 5) return data;
  let next = data;
  const provider = () => next.providers.find((x) => x.id === providerId);

  if (target > current) {
    for (let s = current; s < target; s++) next = completeStep(next, providerId, s, today);
    if (target <= 4) {
      const open: CredentialingRow = { uid: newUid("credentialing"), providerId, step: target, startedDate: today, completedDate: null, waitingOn: "", waitingOnProvider: false };
      next = addRecord(next, "credentialing", open);
      const p = provider();
      if (p && p.status !== "In credentialing") next = updateRecord(next, "providers", p.uid, { status: "In credentialing" });
    } else {
      const p = provider();
      if (p) next = updateRecord(next, "providers", p.uid, { status: "Onboarding" });
      if (!next.onboarding.some((o) => o.providerId === providerId)) {
        const o: OnboardingRow = { uid: newUid("onboarding"), providerId, startDate: addDays(today, 14), stepsDone: 0, stepsTotal: 8, nextStep: "Badge and EHR login" };
        next = addRecord(next, "onboarding", o);
      }
    }
    return next;
  }

  // Backward: reopen the target step and forget the steps after it.
  next = { ...next, credentialing: next.credentialing.filter((r) => !(r.providerId === providerId && r.step > target)) };
  const row = next.credentialing.find((r) => r.providerId === providerId && r.step === target);
  if (row) {
    next = updateRecord(next, "credentialing", row.uid, { completedDate: null, waitingOn: "", waitingOnProvider: false });
  } else {
    const open: CredentialingRow = { uid: newUid("credentialing"), providerId, step: target, startedDate: today, completedDate: null, waitingOn: "", waitingOnProvider: false };
    next = addRecord(next, "credentialing", open);
  }
  const p = provider();
  if (p && p.status !== "In credentialing") next = updateRecord(next, "providers", p.uid, { status: "In credentialing" });
  return next;
}

/** Finishes the provider's current credentialing step today and opens the next one. */
export function advanceCredentialing(data: SheetData, providerId: string, today: ISODate): SheetData {
  const current = currentStepOf(data, providerId);
  return current >= 5 ? data : moveCredentialing(data, providerId, current + 1, today);
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
