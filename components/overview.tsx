"use client";

import Link from "next/link";
import { useDashboard } from "./dashboard-provider";
import { DaysChart, PipelineChart, STAGE_STYLES } from "./charts";
import { PageHeader } from "./page-header";
import { Card, Chip, DataTable, Mono, ProgressBar, cx } from "./ui";
import { formatDate } from "@/lib/dates";
import { PIPELINE_STAGES, CREDENTIAL_STEPS } from "@/lib/types";
import type { AttentionTone, ExpiryBucket } from "@/lib/metrics";
import { useState } from "react";

function Kpi({ label, value, unit, note, tone = "ink" }: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  tone?: "ink" | "accent" | "red" | "amber";
}) {
  const color = { ink: "text-ink", accent: "text-accent", red: "text-red", amber: "text-amber" }[tone];
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-card p-4">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={cx("font-mono text-[32px] font-semibold leading-none", color)}>{value}</span>
        {unit && <span className="text-[13px] text-muted">{unit}</span>}
      </div>
      <div className="text-xs text-muted">{note}</div>
    </div>
  );
}

function KpiCards() {
  const { dash } = useDashboard();
  const k = dash.kpis;
  const diff = k.avgDays === null ? 0 : k.avgDays - dash.targetDays;
  return (
    <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
      <Kpi label="Ready to work" value={String(k.ready)} unit={`of ${k.total}`} note="fully credentialed and enrolled" tone="accent" />
      <Kpi
        label="In credentialing"
        value={String(k.inCredentialing)}
        unit={k.inCredentialing === 1 ? "provider" : "providers"}
        note={`${k.overTarget} past the ${dash.targetDays}-day target`}
      />
      <Kpi
        label="Finished within target"
        value={k.onTimePct === null ? "–" : `${k.onTimePct}%`}
        note={k.recentFinished ? `${k.recentOnTime} of ${k.recentFinished} files · last 90 days` : "no files finished in the last 90 days"}
      />
      <Kpi
        label="Avg days to credential"
        value={k.avgDays === null ? "–" : String(k.avgDays)}
        unit={k.avgDays === null ? "" : "days"}
        note={
          k.avgDays === null
            ? `target ${dash.targetDays} days`
            : `${diff === 0 ? "on" : `${Math.abs(diff)} ${Math.abs(diff) === 1 ? "day" : "days"} ${diff > 0 ? "over" : "under"}`} target of ${dash.targetDays}${k.priorAvgDays !== null ? ` · prior 90 days: ${k.priorAvgDays}` : ""}`
        }
        tone={k.avgDays === null ? "ink" : diff > 0 ? "red" : "accent"}
      />
      <Kpi
        label="Expiring in 60 days"
        value={String(k.expiring60)}
        unit={k.expiring60 === 1 ? "item" : "items"}
        note={`${k.expiring30} within 30 days${k.expired ? ` · ${k.expired} already expired` : ""}`}
        tone={k.expiring30 > 0 ? "red" : "ink"}
      />
      <Kpi
        label="Waiting on provider"
        value={String(k.waitingOnProvider)}
        unit={k.waitingOnProvider === 1 ? "file" : "files"}
        note="documents not sent yet"
      />
    </section>
  );
}

function CredentialingInProgress() {
  const { client, dash } = useDashboard();
  return (
    <Card
      title="Credentialing in progress"
      headingId="cred-heading"
      aside={<Link href={`/${client.id}/credentialing`} className="text-[13px] font-semibold">View all</Link>}
    >
      <DataTable
        caption="Providers currently in credentialing"
        empty="No providers are in credentialing for this selection."
        rows={dash.inProgress}
        rowKey={(v) => v.provider.id}
        columns={[
          {
            header: "Provider",
            cell: (v) => (
              <>
                <div className="font-semibold text-ink">{v.name}</div>
                <div className="text-xs text-muted">{v.provider.specialty}</div>
              </>
            ),
          },
          { header: "Location", cell: (v) => v.provider.location },
          {
            header: "Stage",
            className: "w-[32%]",
            cell: (v) => {
              const over = (v.daysOpen ?? 0) > dash.targetDays;
              const step = v.currentStep ?? 4;
              return (
                <>
                  <div className="mb-1.5 text-xs">
                    {v.currentStep ? `Step ${step} of 4 · ${CREDENTIAL_STEPS[step - 1]}` : "All steps dated · status not updated"}
                  </div>
                  <ProgressBar pct={(step / 4) * 100} tone={over ? "warn" : "good"} label={`${v.name} credentialing progress`} />
                </>
              );
            },
          },
          {
            header: "Days",
            align: "right",
            className: "whitespace-nowrap",
            cell: (v) => {
              const over = (v.daysOpen ?? 0) > dash.targetDays;
              return (
                <>
                  <Mono className={over ? "text-red" : "text-ink"}>{v.daysOpen ?? "–"}</Mono>
                  {over && <div className="text-xs font-semibold text-red">over target</div>}
                </>
              );
            },
          },
          {
            header: "Waiting on",
            cell: (v) =>
              v.currentRow?.waitingOn ? `${v.currentRow.waitingOnProvider ? "Provider: " : ""}${v.currentRow.waitingOn}` : <span className="text-muted">–</span>,
          },
        ]}
      />
    </Card>
  );
}

const GROUP_STYLE: Record<ExpiryBucket, { dot: string; text: string }> = {
  expired: { dot: "bg-red", text: "text-red" },
  d30: { dot: "bg-red", text: "text-red" },
  d60: { dot: "bg-amber", text: "text-amber" },
  d90: { dot: "bg-muted", text: "text-muted" },
  later: { dot: "bg-muted", text: "text-muted" },
};

function ExpiringNext90() {
  const { dash } = useDashboard();
  const groups = dash.expiringGroups.filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <Card title="Expiring in the next 90 days" headingId="exp-heading" aside={`${total} ${total === 1 ? "item" : "items"}`}>
      {groups.length === 0 ? (
        <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">Nothing expires in the next 90 days.</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <h3 className={cx("flex items-center gap-2 text-xs font-semibold", GROUP_STYLE[g.key].text)}>
                <span aria-hidden="true" className={cx("inline-block size-2 rounded-full", GROUP_STYLE[g.key].dot)} />
                {g.label} <span className="font-normal">({g.items.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <li key={`${e.providerId}-${e.item}`} className="flex justify-between gap-3 rounded-md bg-[#f6f8f7] px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{e.name}</div>
                      <div className="text-xs text-muted">{e.item}</div>
                    </div>
                    <div className="whitespace-nowrap text-right">
                      <Mono className="text-ink">{e.days < 0 ? `${-e.days} days ago` : `${e.days} days`}</Mono>
                      <div className="text-xs text-muted">{formatDate(e.date, dash.today)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function WhereTheDaysGo() {
  const { dash } = useDashboard();
  const counted = dash.stepAverages.reduce((n, s) => n + s.count, 0);
  return (
    <Card title="Where the days go" headingId="days-heading" aside="avg days per step">
      {counted === 0 ? (
        <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">No finished credentialing steps yet for this selection.</p>
      ) : (
        <>
          <DaysChart steps={dash.stepAverages} />
          {dash.stepInsight && <p className="mt-2 text-[13px] leading-snug text-body">{dash.stepInsight}</p>}
          <p className="mt-1 text-xs text-muted">Based on {counted} finished steps.</p>
        </>
      )}
    </Card>
  );
}

function RecruitingPipeline() {
  const { dash } = useDashboard();
  return (
    <Card
      title="Recruiting pipeline by open role"
      headingId="pipeline-heading"
      aside={
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-body" aria-label="Legend">
          {PIPELINE_STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ background: STAGE_STYLES[i].fill }} />
              {s}
            </li>
          ))}
        </ul>
      }
    >
      {dash.roles.length === 0 ? (
        <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">No open roles for this selection.</p>
      ) : (
        <PipelineChart roles={dash.roles} />
      )}
    </Card>
  );
}

const TONE: Record<AttentionTone, "bad" | "warn" | "neutral"> = { urgent: "bad", overdue: "bad", waiting: "warn", stalled: "warn" };

function NeedsAttention() {
  const { dash } = useDashboard();
  const [all, setAll] = useState(false);
  const LIMIT = 9;
  const items = all ? dash.attention : dash.attention.slice(0, LIMIT);
  return (
    <Card
      title="Needs attention this week"
      headingId="attention-heading"
      aside={`${dash.attention.length} ${dash.attention.length === 1 ? "item" : "items"}`}
    >
      {dash.attention.length === 0 ? (
        <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">Nothing needs attention for this selection.</p>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col items-start gap-2 rounded-lg border border-line p-3.5">
                <Chip tone={TONE[a.tone]}>{a.tag}</Chip>
                <div className="text-sm font-semibold leading-snug">{a.title}</div>
                <div className="text-[13px] leading-snug text-muted">{a.detail}</div>
                <div className="mt-auto text-xs text-body">Owner: {a.owner}</div>
              </li>
            ))}
          </ul>
          {dash.attention.length > LIMIT && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="mt-3 min-h-11 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold text-ink hover:bg-page"
            >
              {all ? "Show fewer" : `Show all ${dash.attention.length}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

export function OverviewView() {
  return (
    <>
      <PageHeader title="Workforce & credentialing overview" crumb="Overview" />
      <KpiCards />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CredentialingInProgress />
        <ExpiringNext90 />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <WhereTheDaysGo />
        <RecruitingPipeline />
      </div>
      <NeedsAttention />
    </>
  );
}
