"use client";

import { useState } from "react";
import { useDashboard } from "./dashboard-provider";
import { PageHeader } from "./page-header";
import { DataTable } from "./data-table";
import { Card, Chip, Mono, ProgressBar } from "./ui";
import { formatDate } from "@/lib/dates";
import { PIPELINE_STAGES, CREDENTIAL_STEPS } from "@/lib/types";

const checkbox = "size-5 accent-[#1a6b4a]";

export function ProvidersView() {
  const { dash } = useDashboard();
  const rows = [...dash.providers].sort((a, b) => a.provider.name.localeCompare(b.provider.name));
  return (
    <>
      <PageHeader title="Providers" crumb="Providers" />
      <Card title="All providers" headingId="providers-heading" aside={`${rows.length} ${rows.length === 1 ? "provider" : "providers"}`}>
        <DataTable
          caption="Providers"
          empty="No providers match these filters."
          rows={rows}
          rowKey={(v) => v.provider.id}
          columns={[
            { header: "Name", value: (v) => v.provider.name, cell: (v) => <span className="font-semibold text-ink">{v.name}</span> },
            { header: "Credential", value: (v) => v.provider.credential, filter: true, cell: (v) => v.provider.credential },
            { header: "Specialty", value: (v) => v.provider.specialty, filter: true, cell: (v) => v.provider.specialty },
            { header: "Location", value: (v) => v.provider.location, filter: true, cell: (v) => v.provider.location },
            {
              header: "Status",
              value: (v) => v.provider.status,
              filter: true,
              cell: (v) => <Chip tone={v.provider.status === "Ready" ? "good" : "warn"}>{v.provider.status}</Chip>,
            },
          ]}
        />
      </Card>
    </>
  );
}

export function CredentialingView() {
  const { dash } = useDashboard();
  const [showDone, setShowDone] = useState(false);
  const rows = dash.credentialingLines.filter((l) => showDone || !l.completed);
  return (
    <>
      <PageHeader title="Credentialing" crumb="Credentialing" />
      <Card title="Credentialing steps" headingId="cred-steps-heading" aside={`${rows.length} ${rows.length === 1 ? "row" : "rows"}`}>
        <label className="mb-3 flex min-h-11 w-fit items-center gap-2.5 text-sm">
          <input type="checkbox" className={checkbox} checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Include finished steps
        </label>
        <DataTable
          caption="Credentialing steps"
          empty="No credentialing steps in progress for this selection."
          minWidth={720}
          rows={rows}
          rowKey={(l, i) => `${l.providerId}-${l.step}-${i}`}
          columns={[
            { header: "Provider", value: (l) => l.name, cell: (l) => <span className="font-semibold text-ink">{l.name}</span> },
            { header: "Location", value: (l) => l.location, filter: true, cell: (l) => l.location },
            { header: "Step", value: (l) => `${l.step}. ${l.stepLabel}`, filter: true, cell: (l) => `${l.step}. ${l.stepLabel}` },
            { header: "Started", value: (l) => l.started, cell: (l) => formatDate(l.started, dash.today) },
            { header: "Finished", value: (l) => l.completed, cell: (l) => (l.completed ? formatDate(l.completed, dash.today) : <Chip tone="warn">In progress</Chip>) },
            { header: "Days in step", align: "right", value: (l) => l.days, cell: (l) => <Mono className="text-ink">{l.days}</Mono> },
            {
              header: "Waiting on",
              value: (l) => l.waitingOn,
              cell: (l) => (l.waitingOn ? `${l.waitingOnProvider ? "Provider: " : ""}${l.waitingOn}` : <span className="text-muted">–</span>),
            },
          ]}
        />
      </Card>
    </>
  );
}

export function ExpirationsView() {
  const { dash } = useDashboard();
  const [windowDays, setWindowDays] = useState("90");
  const limit = windowDays === "all" ? Infinity : Number(windowDays);
  const rows = dash.expirations.filter((e) => e.days <= limit);
  return (
    <>
      <PageHeader title="Licences & expirations" crumb="Licences & expirations" />
      <Card title="Licences, DEA, board certifications, malpractice, BLS/ACLS" headingId="exp-table-heading" aside={`${rows.length} ${rows.length === 1 ? "item" : "items"}`}>
        <label className="mb-3 flex w-fit flex-col gap-1 text-xs font-medium text-muted">
          Show
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
            className="min-h-11 rounded-md border border-[#c3cec9] bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="30">Expired or expiring within 30 days</option>
            <option value="60">Within 60 days</option>
            <option value="90">Within 90 days</option>
            <option value="all">Everything</option>
          </select>
        </label>
        <DataTable
          caption="Expiring items"
          empty="Nothing expires in this window."
          rows={rows}
          rowKey={(e) => `${e.providerId}-${e.item}`}
          columns={[
            { header: "Provider", value: (e) => e.name, cell: (e) => <span className="font-semibold text-ink">{e.name}</span> },
            { header: "Location", value: (e) => e.location, filter: true, cell: (e) => e.location },
            { header: "Item", value: (e) => e.item, filter: true, cell: (e) => e.item },
            { header: "Expires", value: (e) => e.date, cell: (e) => formatDate(e.date, dash.today) },
            {
              header: "Time left",
              align: "right",
              value: (e) => e.days,
              cell: (e) => (
                <Mono className={e.days <= 30 ? "text-red" : e.days <= 60 ? "text-amber" : "text-ink"}>
                  {e.days < 0 ? `${-e.days} days ago` : `${e.days} days`}
                </Mono>
              ),
            },
            {
              header: "Flag",
              cell: (e) =>
                e.bucket === "expired" ? <Chip tone="bad">Expired</Chip> : e.bucket === "d30" ? <Chip tone="bad">30 days</Chip> : e.bucket === "d60" ? <Chip tone="warn">60 days</Chip> : e.bucket === "d90" ? <Chip>90 days</Chip> : null,
            },
          ]}
        />
      </Card>
    </>
  );
}

export function PayerEnrollmentView() {
  const { dash } = useDashboard();
  const payer = dash.stepAverages[2];
  const rows = dash.inProgress.filter((v) => v.currentStep === 3);
  return (
    <>
      <PageHeader title="Payer enrollment" crumb="Payer enrollment" />
      <Card title={`Providers at step 3 of 4 (${CREDENTIAL_STEPS[2]})`} headingId="payer-heading" aside={`${rows.length} ${rows.length === 1 ? "provider" : "providers"}`}>
        <p className="mb-3 text-sm text-body">
          {payer.avgDays === null
            ? "No finished payer enrollments yet to compare against."
            : `Finished payer enrollments took ${payer.avgDays} days on average (${payer.count} counted).`}
        </p>
        <DataTable
          caption="Providers in payer enrollment"
          empty="Nobody is at the payer enrollment step for this selection."
          rows={rows}
          rowKey={(v) => v.provider.id}
          columns={[
            { header: "Provider", value: (v) => v.name, cell: (v) => <span className="font-semibold text-ink">{v.name}</span> },
            { header: "Location", value: (v) => v.provider.location, filter: true, cell: (v) => v.provider.location },
            { header: "Step started", value: (v) => v.currentRow?.startedDate ?? null, cell: (v) => (v.currentRow ? formatDate(v.currentRow.startedDate, dash.today) : "–") },
            { header: "Days in step", align: "right", value: (v) => v.daysInStep, cell: (v) => <Mono className="text-ink">{v.daysInStep ?? "–"}</Mono> },
            { header: "Days since file opened", align: "right", value: (v) => v.daysOpen, cell: (v) => <Mono className={(v.daysOpen ?? 0) > dash.targetDays ? "text-red" : "text-ink"}>{v.daysOpen ?? "–"}</Mono> },
            {
              header: "Waiting on",
              value: (v) => v.currentRow?.waitingOn ?? "",
              cell: (v) => (v.currentRow?.waitingOn ? `${v.currentRow.waitingOnProvider ? "Provider: " : ""}${v.currentRow.waitingOn}` : <span className="text-muted">–</span>),
            },
          ]}
        />
      </Card>
    </>
  );
}

export function RecruitingView() {
  const { dash } = useDashboard();
  return (
    <>
      <PageHeader title="Recruiting" crumb="Recruiting" />
      <Card title="Open roles" headingId="roles-heading" aside={`${dash.roles.length} ${dash.roles.length === 1 ? "role" : "roles"}`}>
        <DataTable
          caption="Open roles and candidates at each stage"
          empty="No open roles for this selection."
          minWidth={760}
          rows={dash.roles}
          rowKey={(r, i) => `${r.role.title}-${r.role.location}-${i}`}
          columns={[
            { header: "Role", value: (r) => r.role.title, cell: (r) => <span className="font-semibold text-ink">{r.role.title}</span> },
            { header: "Location", value: (r) => r.role.location, filter: true, cell: (r) => r.role.location },
            {
              header: "Open",
              align: "right",
              value: (r) => r.openDays,
              cell: (r) => (
                <>
                  <Mono className={r.stalled ? "text-red" : "text-ink"}>{r.openDays}</Mono> days
                  {r.stalled && <div className="text-xs font-semibold text-red">stalled</div>}
                </>
              ),
            },
            ...PIPELINE_STAGES.map((stage, i) => ({
              header: stage,
              align: "right" as const,
              value: (r: (typeof dash.roles)[number]) => r.role.stages[i],
              cell: (r: (typeof dash.roles)[number]) => <Mono className="text-ink">{r.role.stages[i]}</Mono>,
            })),
            { header: "Total", align: "right", value: (r) => r.total, cell: (r) => <Mono className="text-ink">{r.total}</Mono> },
          ]}
        />
      </Card>
    </>
  );
}

export function OnboardingView() {
  const { dash } = useDashboard();
  return (
    <>
      <PageHeader title="Onboarding" crumb="Onboarding" />
      <Card title="Providers onboarding" headingId="onboarding-heading" aside={`${dash.onboarding.length} ${dash.onboarding.length === 1 ? "provider" : "providers"}`}>
        <DataTable
          caption="Onboarding progress"
          empty="Nobody is onboarding for this selection."
          minWidth={680}
          rows={dash.onboarding}
          rowKey={(o) => o.row.providerId}
          columns={[
            { header: "Provider", value: (o) => o.name, cell: (o) => <span className="font-semibold text-ink">{o.name}</span> },
            { header: "Location", value: (o) => o.location, filter: true, cell: (o) => o.location },
            {
              header: "Start date",
              value: (o) => o.row.startDate,
              cell: (o) => (
                <>
                  {formatDate(o.row.startDate, dash.today)}
                  <div className="text-xs text-muted">
                    {o.daysToStart > 0 ? `in ${o.daysToStart} days` : o.daysToStart === 0 ? "today" : `${-o.daysToStart} days ago`}
                  </div>
                </>
              ),
            },
            {
              header: "Steps done",
              value: (o) => o.pct,
              className: "w-[28%]",
              cell: (o) => (
                <>
                  <div className="mb-1.5 text-xs">
                    <Mono className="text-ink">
                      {o.row.stepsDone} of {o.row.stepsTotal}
                    </Mono>
                  </div>
                  <ProgressBar pct={o.pct} label={`${o.name} onboarding progress`} />
                </>
              ),
            },
            { header: "Next step", value: (o) => o.row.nextStep, cell: (o) => o.row.nextStep || <span className="text-muted">–</span> },
          ]}
        />
      </Card>
    </>
  );
}
