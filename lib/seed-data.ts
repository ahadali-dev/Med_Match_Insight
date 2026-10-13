/**
 * Fake data for the sample "Riverbend tracker" sheet. Every name is invented, there is no real
 * provider or patient data anywhere in this project.
 *
 * Dates are generated relative to the day the sheet is seeded, so the demo always has a few items
 * about to expire, a few files over target, and so on. Nothing here is read by the dashboard code:
 * the dashboard only ever sees the finished sheet (or the local-sample copy of it).
 */
import { addDays, type ISODate } from "./dates";
import type { RawTabs } from "./types";

type Cell = string | number;
export type SeedGrid = Cell[][];

export const SEED_CLIENT_NAME = "Riverbend Medical Group";
export const SEED_SHEET_TITLE = "Riverbend tracker";
export const SEED_LOCATIONS = ["North Clinic", "Downtown ASC", "Lakeside Practice"] as const;

const N = "North Clinic";
const D = "Downtown ASC";
const L = "Lakeside Practice";

interface SeedProvider {
  name: string;
  credential: "MD" | "RN" | "CRNA" | "NP";
  specialty: string;
  location: string;
  status: "Ready" | "In credentialing" | "Onboarding";
}

// 24 providers: 15 Ready, 6 In credentialing, 3 Onboarding.
const PROVIDERS: SeedProvider[] = [
  { name: "R. Singh", credential: "MD", specialty: "Gastroenterology", location: N, status: "Ready" },
  { name: "M. Reyes", credential: "MD", specialty: "Gastroenterology", location: N, status: "In credentialing" },
  { name: "A. Patel", credential: "MD", specialty: "Anesthesia", location: D, status: "In credentialing" },
  { name: "K. Walsh", credential: "MD", specialty: "Orthopedics", location: L, status: "Ready" },
  { name: "L. Chen", credential: "MD", specialty: "Orthopedics", location: L, status: "In credentialing" },
  { name: "T. Nguyen", credential: "CRNA", specialty: "Anesthesia", location: D, status: "Ready" },
  { name: "J. Okafor", credential: "CRNA", specialty: "Anesthesia", location: D, status: "In credentialing" },
  { name: "K. Brooks", credential: "NP", specialty: "Family Medicine", location: N, status: "In credentialing" },
  { name: "S. Alvarez", credential: "RN", specialty: "Nursing", location: D, status: "In credentialing" },
  { name: "B. Harris", credential: "RN", specialty: "Nursing", location: L, status: "Onboarding" },
  { name: "D. Park", credential: "NP", specialty: "Family Medicine", location: L, status: "Onboarding" },
  { name: "E. Novak", credential: "MD", specialty: "Anesthesia", location: D, status: "Onboarding" },
  { name: "H. Larsen", credential: "MD", specialty: "Gastroenterology", location: N, status: "Ready" },
  { name: "C. Mbeki", credential: "MD", specialty: "Family Medicine", location: N, status: "Ready" },
  { name: "G. Rossi", credential: "MD", specialty: "Orthopedics", location: L, status: "Ready" },
  { name: "F. Tanaka", credential: "CRNA", specialty: "Anesthesia", location: D, status: "Ready" },
  { name: "V. Dubois", credential: "RN", specialty: "Nursing", location: N, status: "Ready" },
  { name: "W. Adeyemi", credential: "RN", specialty: "Nursing", location: D, status: "Ready" },
  { name: "N. Kowalski", credential: "NP", specialty: "Family Medicine", location: L, status: "Ready" },
  { name: "I. Haddad", credential: "MD", specialty: "Anesthesia", location: D, status: "Ready" },
  { name: "O. Lindqvist", credential: "RN", specialty: "Nursing", location: L, status: "Ready" },
  { name: "Z. Mehta", credential: "NP", specialty: "Orthopedics", location: L, status: "Ready" },
  { name: "Y. Castillo", credential: "MD", specialty: "Family Medicine", location: L, status: "Ready" },
  { name: "U. Fischer", credential: "CRNA", specialty: "Anesthesia", location: D, status: "Ready" },
];

const idOf = (name: string): string => {
  const i = PROVIDERS.findIndex((p) => p.name === name);
  if (i < 0) throw new Error(`seed: unknown provider ${name}`);
  return `P-${String(i + 1).padStart(2, "0")}`;
};

/** Small deterministic PRNG so the seed looks the same every time it is built. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Credentialing already finished: [provider, days ago it finished, total days it took]. */
const COMPLETED: [string, number, number][] = [
  // Finished in the last 90 days (10 files, 6 inside the 60-day target)
  ["B. Harris", 5, 48],
  ["D. Park", 12, 55],
  ["E. Novak", 20, 52],
  ["R. Singh", 28, 58],
  ["K. Walsh", 37, 60],
  ["T. Nguyen", 49, 63],
  ["H. Larsen", 58, 71],
  ["C. Mbeki", 66, 59],
  ["G. Rossi", 77, 66],
  ["F. Tanaka", 86, 82],
  // Older
  ["V. Dubois", 105, 78],
  ["W. Adeyemi", 118, 92],
  ["N. Kowalski", 131, 66],
  ["I. Haddad", 150, 85],
  ["O. Lindqvist", 170, 74],
  ["Z. Mehta", 190, 99],
  ["Y. Castillo", 215, 69],
  ["U. Fischer", 240, 81],
];

/** Files still open: [provider, current step, days since the file started, days in current step, waiting on, waiting on provider?] */
const IN_PROGRESS: [string, number, number, number, string, boolean][] = [
  ["M. Reyes", 3, 71, 42, "Two commercial payers", false],
  ["A. Patel", 4, 88, 20, "Medical staff committee", false],
  ["J. Okafor", 2, 46, 37, "Board certification letter", true],
  ["L. Chen", 1, 33, 33, "Malpractice history form", true],
  ["K. Brooks", 3, 52, 26, "Medicare enrollment", false],
  ["S. Alvarez", 2, 19, 12, "BLS / ACLS cards", true],
];

/** Expiry dates we want to land inside the next 90 days: [provider, item, days from today]. */
const EXPIRING_SOON: [string, string, number][] = [
  ["R. Singh", "License", 18],
  ["F. Tanaka", "Malpractice", 26],
  ["T. Nguyen", "DEA", 37],
  ["M. Reyes", "Malpractice", 44],
  ["K. Walsh", "Board certification", 58],
  ["B. Harris", "License", 66],
  ["A. Patel", "BLS/ACLS", 79],
  ["H. Larsen", "DEA", 84],
];

const ITEMS_BY_CREDENTIAL: Record<SeedProvider["credential"], string[]> = {
  MD: ["License", "DEA", "Board certification", "Malpractice", "BLS/ACLS"],
  CRNA: ["License", "DEA", "Malpractice", "BLS/ACLS"],
  NP: ["License", "DEA", "Malpractice", "BLS/ACLS"],
  RN: ["License", "BLS/ACLS"],
};

/** Open roles: [title, location, specialty, days open, applied, screened, submitted, interview, offer] */
const ROLES: [string, string, string, number, number, number, number, number, number][] = [
  ["RN, Pre-op / PACU / OR", D, "Nursing", 23, 6, 3, 2, 1, 0],
  ["Gastroenterologist", N, "Gastroenterology", 71, 3, 2, 2, 1, 0],
  ["CRNA", D, "Anesthesia", 40, 4, 2, 1, 1, 1],
  ["Nurse practitioner", L, "Family Medicine", 15, 4, 1, 1, 0, 0],
  ["Orthopedic surgeon", L, "Orthopedics", 64, 5, 3, 1, 0, 0],
  ["Front desk lead", N, "", 9, 3, 1, 0, 0, 0],
];

/** Onboarding: [provider, days until start, steps done, steps total, next step] */
const ONBOARDING: [string, number, number, number, string][] = [
  ["E. Novak", 5, 7, 8, "Badge pickup"],
  ["B. Harris", 10, 5, 8, "Badge and EHR login"],
  ["D. Park", 21, 2, 8, "Occupational health screening"],
];

function splitSteps(total: number, rand: () => number): number[] {
  const weights = [0.12, 0.25, 0.43, 0.2].map((w) => w + (rand() - 0.5) * 0.06);
  const steps = weights.slice(0, 3).map((w) => Math.max(3, Math.round(total * w)));
  steps.push(Math.max(3, total - steps.reduce((a, b) => a + b, 0)));
  return steps;
}

/** Splits the days spent before the current step across the `count` steps already finished. */
function splitPrior(days: number, count: number, rand: () => number): number[] {
  const base = [0.12, 0.25, 0.43].slice(0, count).map((w) => w + (rand() - 0.5) * 0.04);
  const sum = base.reduce((a, b) => a + b, 0);
  const parts = base.map((w) => Math.max(1, Math.round((days * w) / sum)));
  parts[parts.length - 1] += days - parts.reduce((a, b) => a + b, 0);
  return parts;
}

export const SEED_HEADERS = {
  Providers: ["id", "name", "credential", "specialty", "location", "status"],
  Credentialing: ["provider_id", "step", "started_date", "completed_date", "waiting_on", "waiting_on_provider"],
  Expirations: ["provider_id", "item", "expiry_date"],
  Roles: ["title", "location", "specialty", "opened_date", "applied", "screened", "submitted", "interview", "offer"],
  Onboarding: ["provider_id", "start_date", "steps_done", "steps_total", "next_step"],
  Config: ["client_name", "target_days_to_credential"],
} as const;

export function buildSeedTabs(today: ISODate): RawTabs {
  const rand = rng(20240611);

  const providers: SeedGrid = [
    [...SEED_HEADERS.Providers],
    ...PROVIDERS.map((p) => [idOf(p.name), p.name, p.credential, p.specialty, p.location, p.status]),
  ];

  const credentialing: SeedGrid = [[...SEED_HEADERS.Credentialing]];
  for (const [name, daysAgo, total] of COMPLETED) {
    const finished = addDays(today, -daysAgo);
    let cursor = addDays(finished, -total);
    splitSteps(total, rand).forEach((len, i) => {
      const end = addDays(cursor, len);
      credentialing.push([idOf(name), i + 1, cursor, end, "", "no"]);
      cursor = end;
    });
  }
  for (const [name, step, daysOpen, daysInStep, waitingOn, byProvider] of IN_PROGRESS) {
    let cursor = addDays(today, -daysOpen);
    const priorDays = daysOpen - daysInStep;
    const prior = step > 1 ? splitPrior(priorDays, step - 1, rand) : [];
    prior.forEach((len, i) => {
      const end = addDays(cursor, len);
      credentialing.push([idOf(name), i + 1, cursor, end, "", "no"]);
      cursor = end;
    });
    credentialing.push([idOf(name), step, addDays(today, -daysInStep), "", waitingOn, byProvider ? "yes" : "no"]);
  }

  const expirations: SeedGrid = [[...SEED_HEADERS.Expirations]];
  PROVIDERS.forEach((p, pi) => {
    ITEMS_BY_CREDENTIAL[p.credential].forEach((item, ii) => {
      const forced = EXPIRING_SOON.find(([n, it]) => n === p.name && it === item);
      const days = forced ? forced[2] : 100 + ((pi * 37 + ii * 61) % 560) + Math.floor(rand() * 20);
      expirations.push([idOf(p.name), item, addDays(today, days)]);
    });
  });
  for (const [name, item] of EXPIRING_SOON) {
    if (!expirations.some((r) => r[0] === idOf(name) && r[1] === item)) {
      throw new Error(`seed: ${name} has no "${item}" to expire soon`);
    }
  }

  const roles: SeedGrid = [
    [...SEED_HEADERS.Roles],
    ...ROLES.map(([title, loc, spec, open, a, s, sub, i, o]) => [title, loc, spec, addDays(today, -open), a, s, sub, i, o]),
  ];

  const onboarding: SeedGrid = [
    [...SEED_HEADERS.Onboarding],
    ...ONBOARDING.map(([name, inDays, done, total, next]) => [idOf(name), addDays(today, inDays), done, total, next]),
  ];

  const config: SeedGrid = [[...SEED_HEADERS.Config], [SEED_CLIENT_NAME, 60]];

  return { Providers: providers, Credentialing: credentialing, Expirations: expirations, Roles: roles, Onboarding: onboarding, Config: config };
}
