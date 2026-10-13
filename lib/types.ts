import type { ISODate } from "./dates";

export const TAB_NAMES = [
  "Providers",
  "Credentialing",
  "Expirations",
  "Roles",
  "Onboarding",
  "Config",
] as const;
export type TabName = (typeof TAB_NAMES)[number];

/** Raw cell grid per tab, exactly as returned by the Sheets API (row 0 = headers). */
export type RawTabs = Record<TabName, unknown[][]>;

export const PROVIDER_STATUSES = ["Ready", "In credentialing", "Onboarding"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const CREDENTIAL_STEPS = ["Application", "Verification", "Payer enrollment", "Privileges"] as const;
export const PIPELINE_STAGES = ["Applied", "Screened", "Submitted", "Interview", "Offer"] as const;

export interface Provider {
  /** Stable row identity inside the app (used for editing). */
  uid: string;
  id: string;
  name: string;
  credential: string;
  specialty: string;
  location: string;
  status: ProviderStatus;
}

export interface CredentialingRow {
  /** Stable row identity inside the app (used for editing). */
  uid: string;
  providerId: string;
  /** 1 to 4 */
  step: number;
  startedDate: ISODate;
  /** Blank while the step is still in progress. */
  completedDate: ISODate | null;
  waitingOn: string;
  waitingOnProvider: boolean;
}

export interface Expiration {
  /** Stable row identity inside the app (used for editing). */
  uid: string;
  providerId: string;
  item: string;
  expiryDate: ISODate;
}

export interface Role {
  /** Stable row identity inside the app (used for editing). */
  uid: string;
  title: string;
  location: string;
  /** Optional column. Blank means the role applies to every specialty. */
  specialty: string;
  openedDate: ISODate;
  /** Candidates currently at each stage, in PIPELINE_STAGES order. */
  stages: [number, number, number, number, number];
}

export interface OnboardingRow {
  /** Stable row identity inside the app (used for editing). */
  uid: string;
  providerId: string;
  startDate: ISODate;
  stepsDone: number;
  stepsTotal: number;
  nextStep: string;
}

export interface SheetConfig {
  clientName: string;
  targetDays: number;
}

export interface SheetData {
  config: SheetConfig;
  providers: Provider[];
  credentialing: CredentialingRow[];
  expirations: Expiration[];
  roles: Role[];
  onboarding: OnboardingRow[];
  /** Rows that were skipped or defaulted while reading the sheet. */
  warnings: string[];
  source: {
    kind: "google" | "demo";
    /** Title of the spreadsheet file. */
    title: string;
    url: string | null;
    tabCount: number;
  };
  /** When the sheet was read from Google (ISO timestamp). */
  fetchedAt: string;
}
