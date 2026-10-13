/**
 * Every number on the dashboard comes from here, and every function here reads only the sheet data
 * it is given (plus today's date and the target from the Config tab). Nothing is hard-coded except
 * the rule thresholds below, which are shown in the UI wherever they apply.
 */
import { diffDays, formatDate, type ISODate } from "./dates";
import {
  CREDENTIAL_STEPS,
  type CredentialingRow,
  type OnboardingRow,
  type Provider,
  type Role,
  type SheetData,
} from "./types";

/** Roles open longer than this are flagged as stalled. */
export const STALLED_ROLE_DAYS = 60;
/** Window for "finished within target" and "avg days to credential". */
export const RECENT_WINDOW_DAYS = 90;

export interface Filters {
  /** "" means all. */
  location: string;
  specialty: string;
}
export const NO_FILTERS: Filters = { location: "", specialty: "" };

export function displayName(p: Pick<Provider, "name" | "credential">): string {
  return p.credential === "MD" ? `Dr. ${p.name}` : `${p.name}, ${p.credential}`;
}

export interface ProviderView {
  provider: Provider;
  name: string;
  rows: CredentialingRow[];
  firstStart: ISODate | null;
  /** Set once all four steps have a completed date. */
  completedDate: ISODate | null;
  /** Calendar days from first step start to last step completion. */
  totalDays: number | null;
  /** First step (1-4) without a completed date, or null when all four are done or no rows exist. */
  currentStep: number | null;
  currentRow: CredentialingRow | null;
  /** Days since the file started. Null when there are no credentialing rows. */
  daysOpen: number | null;
  daysInStep: number | null;
}

export type ExpiryBucket = "expired" | "d30" | "d60" | "d90" | "later";

export interface ExpirationView {
  providerId: string;
  name: string;
  location: string;
  status: Provider["status"];
  item: string;
  date: ISODate;
  days: number;
  bucket: ExpiryBucket;
}

export interface CredentialingLine {
  providerId: string;
  name: string;
  location: string;
  step: number;
  stepLabel: string;
  started: ISODate;
  completed: ISODate | null;
  /** Days spent in the step (so far, if it is still open). */
  days: number;
  waitingOn: string;
  waitingOnProvider: boolean;
}

export interface RoleView {
  role: Role;
  openDays: number;
  total: number;
  stalled: boolean;
}

export interface OnboardingView {
  row: OnboardingRow;
  name: string;
  location: string;
  daysToStart: number;
  pct: number;
}

export type AttentionTone = "urgent" | "overdue" | "waiting" | "stalled";
export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  tag: string;
  title: string;
  detail: string;
  owner: string;
}

export interface Kpis {
  ready: number;
  total: number;
  inCredentialing: number;
  overTarget: number;
  /** Credentialing files finished in the last 90 days. */
  recentFinished: number;
  recentOnTime: number;
  onTimePct: number | null;
  avgDays: number | null;
  /** Average for the 90 days before that, for comparison. */
  priorAvgDays: number | null;
  expiring60: number;
  expiring30: number;
  expired: number;
  waitingOnProvider: number;
}

export interface Dashboard {
  today: ISODate;
  targetDays: number;
  clientName: string;
  locations: string[];
  specialties: string[];
  providers: ProviderView[];
  kpis: Kpis;
  inProgress: ProviderView[];
  credentialingLines: CredentialingLine[];
  expirations: ExpirationView[];
  expiringGroups: { key: ExpiryBucket; label: string; items: ExpirationView[] }[];
  stepAverages: { step: number; label: string; avgDays: number | null; count: number }[];
  stepInsight: string | null;
  roles: RoleView[];
  onboarding: OnboardingView[];
  attention: AttentionItem[];
}

function bucketOf(days: number): ExpiryBucket {
  if (days < 0) return "expired";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return "later";
}

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
/** "Two commercial payers" -> "two commercial payers" mid-sentence, but leaves "BLS / ACLS" alone. */
const lcFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function viewProvider(provider: Provider, allRows: CredentialingRow[], today: ISODate): ProviderView {
  const rows = allRows.filter((r) => r.providerId === provider.id).sort((a, b) => a.step - b.step);
  const name = displayName(provider);
  if (rows.length === 0) {
    return { provider, name, rows, firstStart: null, completedDate: null, totalDays: null, currentStep: null, currentRow: null, daysOpen: null, daysInStep: null };
  }
  const firstStart = rows.reduce((min, r) => (r.startedDate < min ? r.startedDate : min), rows[0].startedDate);
  const doneSteps = new Set(rows.filter((r) => r.completedDate).map((r) => r.step));
  const allDone = [1, 2, 3, 4].every((s) => doneSteps.has(s));
  const completedDate = allDone
    ? rows.reduce((max, r) => (r.completedDate && r.completedDate > max ? r.completedDate : max), "0000-00-00")
    : null;
  const currentStep = allDone ? null : ([1, 2, 3, 4].find((s) => !doneSteps.has(s)) ?? null);
  const currentRow = currentStep ? (rows.find((r) => r.step === currentStep) ?? null) : null;
  return {
    provider,
    name,
    rows,
    firstStart,
    completedDate,
    totalDays: completedDate ? diffDays(firstStart, completedDate) : null,
    currentStep,
    currentRow,
    daysOpen: completedDate ? null : Math.max(0, diffDays(firstStart, today)),
    daysInStep: currentRow ? Math.max(0, diffDays(currentRow.startedDate, today)) : null,
  };
}

export function buildDashboard(data: SheetData, filters: Filters, today: ISODate): Dashboard {
  const target = data.config.targetDays;

  const locations = unique([...data.providers.map((p) => p.location), ...data.roles.map((r) => r.location)]);
  const specialties = unique(data.providers.map((p) => p.specialty));

  // ---- filters apply to everything below
  const providers = data.providers.filter(
    (p) => (!filters.location || p.location === filters.location) && (!filters.specialty || p.specialty === filters.specialty),
  );
  const byId = new Map(providers.map((p) => [p.id, p]));
  const views = providers.map((p) => viewProvider(p, data.credentialing, today));
  const viewById = new Map(views.map((v) => [v.provider.id, v]));

  // ---- KPIs
  const inProgress = views
    .filter((v) => v.provider.status === "In credentialing")
    .sort((a, b) => (b.daysOpen ?? -1) - (a.daysOpen ?? -1));
  const overTargetViews = inProgress.filter((v) => (v.daysOpen ?? 0) > target);

  const finished = views.filter((v) => v.completedDate && v.totalDays !== null);
  const sinceFinish = (v: ProviderView) => diffDays(v.completedDate as ISODate, today);
  const recent = finished.filter((v) => sinceFinish(v) >= 0 && sinceFinish(v) <= RECENT_WINDOW_DAYS);
  const prior = finished.filter((v) => sinceFinish(v) > RECENT_WINDOW_DAYS && sinceFinish(v) <= RECENT_WINDOW_DAYS * 2);
  const recentOnTime = recent.filter((v) => (v.totalDays as number) <= target).length;
  const avgRecent = avg(recent.map((v) => v.totalDays as number));
  const avgPrior = avg(prior.map((v) => v.totalDays as number));

  const waitingOnProviderViews = inProgress.filter((v) => v.currentRow?.waitingOnProvider);

  // ---- expirations
  const expirations: ExpirationView[] = data.expirations
    .filter((e) => byId.has(e.providerId))
    .map((e) => {
      const p = byId.get(e.providerId) as Provider;
      const days = diffDays(today, e.expiryDate);
      return {
        providerId: p.id,
        name: displayName(p),
        location: p.location,
        status: p.status,
        item: e.item,
        date: e.expiryDate,
        days,
        bucket: bucketOf(days),
      };
    })
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));

  const within = (n: number) => expirations.filter((e) => e.days <= n);
  const expiringGroups: Dashboard["expiringGroups"] = [
    { key: "expired", label: "Already expired", items: expirations.filter((e) => e.bucket === "expired") },
    { key: "d30", label: "Within 30 days", items: expirations.filter((e) => e.bucket === "d30") },
    { key: "d60", label: "31 to 60 days", items: expirations.filter((e) => e.bucket === "d60") },
    { key: "d90", label: "61 to 90 days", items: expirations.filter((e) => e.bucket === "d90") },
  ];

  // ---- where the days go
  const stepAverages = CREDENTIAL_STEPS.map((label, i) => {
    const durations = data.credentialing
      .filter((r) => r.step === i + 1 && r.completedDate && byId.has(r.providerId))
      .map((r) => diffDays(r.startedDate, r.completedDate as ISODate));
    const a = avg(durations);
    return { step: i + 1, label, avgDays: a === null ? null : Math.round(a), count: durations.length };
  });
  const measured = stepAverages.filter((s) => s.avgDays !== null);
  let stepInsight: string | null = null;
  if (measured.length > 0) {
    const longest = measured.reduce((a, b) => ((b.avgDays as number) > (a.avgDays as number) ? b : a));
    const sum = measured.reduce((t, s) => t + (s.avgDays as number), 0);
    stepInsight = `${longest.label} takes the longest: ${longest.avgDays} of the ${sum} days.`;
  }

  // ---- roles & onboarding
  const roles: RoleView[] = data.roles
    .filter(
      (r) =>
        (!filters.location || r.location === filters.location) &&
        (!filters.specialty || r.specialty === "" || r.specialty === filters.specialty),
    )
    .map((role) => {
      const openDays = Math.max(0, diffDays(role.openedDate, today));
      return { role, openDays, total: role.stages.reduce((a, b) => a + b, 0), stalled: openDays > STALLED_ROLE_DAYS };
    })
    .sort((a, b) => b.openDays - a.openDays);

  const onboarding: OnboardingView[] = data.onboarding
    .filter((o) => byId.has(o.providerId))
    .map((row) => {
      const p = byId.get(row.providerId) as Provider;
      return {
        row,
        name: displayName(p),
        location: p.location,
        daysToStart: diffDays(today, row.startDate),
        pct: Math.round((row.stepsDone / row.stepsTotal) * 100),
      };
    })
    .sort((a, b) => a.row.startDate.localeCompare(b.row.startDate));

  // ---- credentialing tab lines
  const credentialingLines: CredentialingLine[] = data.credentialing
    .filter((r) => viewById.has(r.providerId))
    .map((r) => {
      const v = viewById.get(r.providerId) as ProviderView;
      return {
        providerId: r.providerId,
        name: v.name,
        location: v.provider.location,
        step: r.step,
        stepLabel: CREDENTIAL_STEPS[r.step - 1],
        started: r.startedDate,
        completed: r.completedDate,
        days: Math.max(0, diffDays(r.startedDate, r.completedDate ?? today)),
        waitingOn: r.completedDate ? "" : r.waitingOn,
        waitingOnProvider: !r.completedDate && r.waitingOnProvider,
      };
    })
    .sort((a, b) => Number(!!a.completed) - Number(!!b.completed) || a.name.localeCompare(b.name) || a.step - b.step);

  // ---- needs attention (rules)
  const attention: AttentionItem[] = [];
  for (const e of expirations.filter((x) => x.days <= 30)) {
    const when = e.days < 0 ? `expired ${plural(-e.days, "day")} ago` : e.days === 0 ? "expires today" : `expires ${formatDate(e.date, today)}`;
    attention.push({
      id: `exp-${e.providerId}-${e.item}`,
      tone: "urgent",
      tag: e.days < 0 ? "Expired" : "Urgent",
      title: `${e.item} for ${e.name} ${when}`,
      detail: e.days < 0 ? `Lapsed on ${formatDate(e.date, today)}. ${e.location}.` : `${plural(e.days, "day")} left. ${e.location}.`,
      owner: "Credentialing",
    });
  }
  for (const v of overTargetViews) {
    const over = (v.daysOpen as number) - target;
    const where = v.currentStep ? `Now at step ${v.currentStep} of 4 (${CREDENTIAL_STEPS[v.currentStep - 1]})` : "All four steps have dates";
    const waiting = v.currentRow?.waitingOn ? `, waiting on ${lcFirst(v.currentRow.waitingOn)}` : "";
    attention.push({
      id: `over-${v.provider.id}`,
      tone: "overdue",
      tag: "Overdue",
      title: `${v.name} at ${v.daysOpen} days in credentialing`,
      detail: `${plural(over, "day")} over the ${target}-day target. ${where}${waiting}.`,
      owner: "Credentialing",
    });
  }
  if (waitingOnProviderViews.length > 0) {
    const n = waitingOnProviderViews.length;
    const shown = waitingOnProviderViews.slice(0, 3).map((v) => `${v.name}${v.currentRow?.waitingOn ? ` (${v.currentRow.waitingOn})` : ""}`);
    const rest = n - shown.length;
    attention.push({
      id: "waiting-provider",
      tone: "waiting",
      tag: "Waiting",
      title: `${plural(n, "provider")} ${n === 1 ? "has" : "have"} not sent documents`,
      detail: `${shown.join("; ")}${rest > 0 ? `; and ${rest} more` : ""}.`,
      owner: "Credentialing",
    });
  }
  for (const r of roles.filter((x) => x.stalled)) {
    const [, , , interview, offer] = r.role.stages;
    attention.push({
      id: `role-${r.role.title}-${r.role.location}`,
      tone: "stalled",
      tag: "Stalled",
      title: `${r.role.title} search open ${r.openDays} days`,
      detail: `${r.role.location}. ${plural(r.total, "candidate")} in the pipeline, ${interview} at interview, ${plural(offer, "offer")}.`,
      owner: "Recruiting",
    });
  }

  return {
    today,
    targetDays: target,
    clientName: data.config.clientName,
    locations,
    specialties,
    providers: views,
    kpis: {
      ready: providers.filter((p) => p.status === "Ready").length,
      total: providers.length,
      inCredentialing: inProgress.length,
      overTarget: overTargetViews.length,
      recentFinished: recent.length,
      recentOnTime,
      onTimePct: recent.length ? Math.round((recentOnTime / recent.length) * 100) : null,
      avgDays: avgRecent === null ? null : Math.round(avgRecent),
      priorAvgDays: avgPrior === null ? null : Math.round(avgPrior),
      expiring60: within(60).length,
      expiring30: within(30).length,
      expired: expirations.filter((e) => e.days < 0).length,
      waitingOnProvider: waitingOnProviderViews.length,
    },
    inProgress,
    credentialingLines,
    expirations,
    expiringGroups,
    stepAverages,
    stepInsight,
    roles,
    onboarding,
    attention,
  };
}

