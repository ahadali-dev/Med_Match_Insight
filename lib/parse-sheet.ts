import { normalizeDate } from "./dates";
import { SheetError } from "./errors";
import {
  PROVIDER_STATUSES,
  TAB_NAMES,
  type CredentialingRow,
  type Expiration,
  type OnboardingRow,
  type Provider,
  type ProviderStatus,
  type RawTabs,
  type Role,
  type SheetConfig,
  type SheetData,
  type TabName,
} from "./types";

type Cells = Record<string, unknown>;
interface TableRow {
  /** 1-based row number as the person sees it in the sheet. */
  row: number;
  cells: Cells;
}

function headerKey(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function text(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = text(v).replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function yes(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return ["yes", "y", "true", "1", "x"].includes(text(v).toLowerCase());
}

/** Reads a tab into rows keyed by header name. Blank rows are dropped. */
function readTable(grid: unknown[][], tab: TabName, required: string[]): TableRow[] {
  if (!grid || grid.length === 0) {
    throw new SheetError("bad_schema", `The "${tab}" tab is empty. Row 1 must hold the column headers: ${required.join(", ")}.`);
  }
  const headers = grid[0].map(headerKey);
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    throw new SheetError(
      "bad_schema",
      `The "${tab}" tab is missing the column${missing.length > 1 ? "s" : ""} ${missing.map((m) => `"${m}"`).join(", ")}. Row 1 must hold the column headers.`,
    );
  }
  const rows: TableRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const line = grid[i] ?? [];
    if (line.every((c) => text(c) === "")) continue;
    const cells: Cells = {};
    headers.forEach((h, idx) => {
      if (h) cells[h] = line[idx];
    });
    rows.push({ row: i + 1, cells });
  }
  return rows;
}

function readConfig(grid: unknown[][], warnings: string[]): SheetConfig {
  const config: SheetConfig = { clientName: "Client", targetDays: 60 };
  let name = "";
  let target: number | null = null;

  if (grid && grid.length > 0) {
    const headers = grid[0].map(headerKey);
    if (headers.includes("client_name") || headers.includes("target_days_to_credential")) {
      // Header layout: row 1 = column names, row 2 = values.
      const values = grid[1] ?? [];
      const at = (key: string) => values[headers.indexOf(key)];
      name = text(at("client_name"));
      target = num(at("target_days_to_credential"));
    } else {
      // Key/value layout: column A = setting name, column B = value.
      for (const line of grid) {
        const key = headerKey(line[0]);
        if (key === "client_name") name = text(line[1]);
        if (key === "target_days_to_credential") target = num(line[1]);
      }
    }
  }

  if (name) config.clientName = name;
  else warnings.push('Config: "client_name" is blank, using "Client".');
  if (target !== null && target > 0) config.targetDays = Math.round(target);
  else warnings.push('Config: "target_days_to_credential" is missing or invalid, using 60.');
  return config;
}

/**
 * Turns the raw cell grids into typed data. Bad rows are skipped and reported in `warnings`;
 * a missing tab or column throws a SheetError because nothing sensible can be shown.
 */
export function parseSheet(raw: RawTabs, source: SheetData["source"], fetchedAt: string): SheetData {
  const warnings: string[] = [];
  const skip = (tab: TabName, row: number, why: string) => warnings.push(`${tab} row ${row}: ${why}. Row skipped.`);

  // Providers
  const providers: Provider[] = [];
  const providerIds = new Set<string>();
  for (const { row, cells } of readTable(raw.Providers, "Providers", ["id", "name", "credential", "specialty", "location", "status"])) {
    const id = text(cells.id);
    const status = PROVIDER_STATUSES.find((s) => s.toLowerCase() === text(cells.status).toLowerCase());
    if (!id || !text(cells.name)) {
      skip("Providers", row, "id or name is blank");
    } else if (providerIds.has(id)) {
      skip("Providers", row, `duplicate id "${id}"`);
    } else if (!status) {
      skip("Providers", row, `status "${text(cells.status)}" is not one of ${PROVIDER_STATUSES.join(" / ")}`);
    } else {
      providerIds.add(id);
      providers.push({
        uid: `providers:${row}`,
        id,
        name: text(cells.name),
        credential: text(cells.credential),
        specialty: text(cells.specialty),
        location: text(cells.location),
        status: status as ProviderStatus,
      });
    }
  }

  // Credentialing
  const credentialing: CredentialingRow[] = [];
  for (const { row, cells } of readTable(raw.Credentialing, "Credentialing", ["provider_id", "step", "started_date"])) {
    const providerId = text(cells.provider_id);
    const step = num(cells.step);
    const startedDate = normalizeDate(cells.started_date);
    const completedRaw = cells.completed_date;
    const completedDate = normalizeDate(completedRaw);
    if (!providerIds.has(providerId)) skip("Credentialing", row, `provider_id "${providerId}" is not in Providers`);
    else if (step === null || !Number.isInteger(step) || step < 1 || step > 4) skip("Credentialing", row, "step must be 1, 2, 3 or 4");
    else if (!startedDate) skip("Credentialing", row, "started_date is blank or not a date");
    else if (text(completedRaw) !== "" && !completedDate) skip("Credentialing", row, "completed_date is not a date");
    else {
      credentialing.push({
        uid: `credentialing:${row}`,
        providerId,
        step,
        startedDate,
        completedDate,
        waitingOn: text(cells.waiting_on),
        waitingOnProvider: yes(cells.waiting_on_provider),
      });
    }
  }

  // Expirations
  const expirations: Expiration[] = [];
  for (const { row, cells } of readTable(raw.Expirations, "Expirations", ["provider_id", "item", "expiry_date"])) {
    const providerId = text(cells.provider_id);
    const expiryDate = normalizeDate(cells.expiry_date);
    if (!providerIds.has(providerId)) skip("Expirations", row, `provider_id "${providerId}" is not in Providers`);
    else if (!text(cells.item)) skip("Expirations", row, "item is blank");
    else if (!expiryDate) skip("Expirations", row, "expiry_date is blank or not a date");
    else expirations.push({ uid: `expirations:${row}`, providerId, item: text(cells.item), expiryDate });
  }

  // Roles
  const roles: Role[] = [];
  for (const { row, cells } of readTable(raw.Roles, "Roles", ["title", "location", "opened_date", "applied", "screened", "submitted", "interview", "offer"])) {
    const openedDate = normalizeDate(cells.opened_date);
    if (!text(cells.title)) skip("Roles", row, "title is blank");
    else if (!openedDate) skip("Roles", row, "opened_date is blank or not a date");
    else {
      const n = (k: string) => Math.max(0, Math.round(num(cells[k]) ?? 0));
      roles.push({
        uid: `roles:${row}`,
        title: text(cells.title),
        location: text(cells.location),
        specialty: text(cells.specialty),
        openedDate,
        stages: [n("applied"), n("screened"), n("submitted"), n("interview"), n("offer")],
      });
    }
  }

  // Onboarding
  const onboarding: OnboardingRow[] = [];
  for (const { row, cells } of readTable(raw.Onboarding, "Onboarding", ["provider_id", "start_date", "steps_done", "steps_total", "next_step"])) {
    const providerId = text(cells.provider_id);
    const startDate = normalizeDate(cells.start_date);
    const stepsTotal = num(cells.steps_total);
    const stepsDone = num(cells.steps_done) ?? 0;
    if (!providerIds.has(providerId)) skip("Onboarding", row, `provider_id "${providerId}" is not in Providers`);
    else if (!startDate) skip("Onboarding", row, "start_date is blank or not a date");
    else if (stepsTotal === null || stepsTotal <= 0) skip("Onboarding", row, "steps_total must be a number above 0");
    else {
      onboarding.push({
        uid: `onboarding:${row}`,
        providerId,
        startDate,
        stepsDone: Math.min(Math.max(0, Math.round(stepsDone)), Math.round(stepsTotal)),
        stepsTotal: Math.round(stepsTotal),
        nextStep: text(cells.next_step),
      });
    }
  }

  const config = readConfig(raw.Config, warnings);

  return { config, providers, credentialing, expirations, roles, onboarding, warnings, source, fetchedAt };
}

export function isTabName(name: string): name is TabName {
  return (TAB_NAMES as readonly string[]).includes(name);
}
