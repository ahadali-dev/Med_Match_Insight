"use client";

import { useState } from "react";
import { useActions, useDashboard, useUi } from "./dashboard-provider";
import { DataTable } from "./data-table";
import { AddForm } from "./edit-cells";
import { PageHeader } from "./page-header";
import { ProviderLink } from "./provider-link";
import { Card, Chip, Mono, ProgressBar, cx } from "./ui";
import { formatDate } from "@/lib/dates";
import { displayName } from "@/lib/metrics";
import { CREDENTIAL_STEPS, PIPELINE_STAGES, PROVIDER_STATUSES, type Role } from "@/lib/types";

const CREDENTIALS = ["MD", "RN", "CRNA", "NP"];
const EXPIRY_ITEMS = ["Licence", "DEA", "Board certification", "Malpractice", "BLS/ACLS"];
const YES_NO = ["yes", "no"];
const checkbox = "size-5 accent-[#1a6b4a]";

const toInt = (v: string) => Math.max(0, Math.round(Number(v) || 0));
const EditHint = () => (
  <p className="mb-3 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg">
    Editing is on. Change any cell, add rows, or delete rows. Every change updates the whole dashboard and can be undone.
  </p>
);

function useProviderOptions() {
  const { data } = useDashboard();
  const options = data.providers.map((p) => `${p.id} · ${displayName(p)}`);
  return { options, idOf: (label: string) => label.split(" · ")[0] };
}

export function ProvidersView() {
  const { dash } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  const rows = [...dash.providers].sort((a, b) => a.provider.name.localeCompare(b.provider.name));
  return (
    <>
      <PageHeader title="Providers" crumb="Providers" />
      <Card title="All providers" headingId="providers-heading" aside={`${rows.length} ${rows.length === 1 ? "provider" : "providers"}`}>
        {canEdit && (
          <>
            <EditHint />
            <div className="mb-4">
              <AddForm
                buttonLabel="Add provider"
                title="Add provider"
                fields={[
                  { key: "name", label: "Name (e.g. J. Smith)", type: "text", required: true },
                  { key: "credential", label: "Credential", type: "select", options: CREDENTIALS },
                  { key: "specialty", label: "Specialty", type: "combo", options: dash.specialties, required: true },
                  { key: "location", label: "Location", type: "combo", options: dash.locations, required: true },
                  { key: "start", label: "Start credentialing now?", type: "select", options: YES_NO, initial: "yes" },
                ]}
                onSubmit={(v) =>
                  actions.addProvider({ name: v.name.trim(), credential: v.credential, specialty: v.specialty.trim(), location: v.location.trim() }, v.start === "yes")
                }
              />
            </div>
          </>
        )}
        <DataTable
          caption="Providers"
          empty="No providers match these filters."
          rows={rows}
          rowKey={(v) => v.provider.uid}
          editing={canEdit}
          rowLabel={(v) => v.name}
          onDelete={(v) => actions.remove("providers", v.provider.uid, `${v.name} deleted.`)}
          columns={[
            {
              header: "Name",
              value: (v) => v.provider.name,
              cell: (v) => <ProviderLink id={v.provider.id}>{v.name}</ProviderLink>,
              edit: { type: "text", get: (v) => v.provider.name, set: (v, x) => actions.update("providers", v.provider.uid, { name: x }) },
            },
            {
              header: "Credential",
              value: (v) => v.provider.credential,
              filter: true,
              cell: (v) => v.provider.credential,
              edit: { type: "select", options: CREDENTIALS, get: (v) => v.provider.credential, set: (v, x) => actions.update("providers", v.provider.uid, { credential: x }) },
            },
            {
              header: "Specialty",
              value: (v) => v.provider.specialty,
              filter: true,
              cell: (v) => v.provider.specialty,
              edit: { type: "combo", options: dash.specialties, get: (v) => v.provider.specialty, set: (v, x) => actions.update("providers", v.provider.uid, { specialty: x }) },
            },
            {
              header: "Location",
              value: (v) => v.provider.location,
              filter: true,
              cell: (v) => v.provider.location,
              edit: { type: "combo", options: dash.locations, get: (v) => v.provider.location, set: (v, x) => actions.update("providers", v.provider.uid, { location: x }) },
            },
            {
              header: "Status",
              value: (v) => v.provider.status,
              filter: true,
              cell: (v) => <Chip tone={v.provider.status === "Ready" ? "good" : "warn"}>{v.provider.status}</Chip>,
              edit: {
                type: "select",
                options: [...PROVIDER_STATUSES],
                get: (v) => v.provider.status,
                set: (v, x) => actions.update("providers", v.provider.uid, { status: x as (typeof PROVIDER_STATUSES)[number] }),
              },
            },
          ]}
        />
      </Card>
    </>
  );
}

function Board() {
  const { dash } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {CREDENTIAL_STEPS.map((label, i) => {
        const step = i + 1;
        const cards = dash.inProgress.filter((v) => v.currentStep === step);
        return (
          <section key={label} aria-label={`Step ${step}: ${label}`} className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-page p-3">
            <h3 className="flex items-center justify-between text-sm font-semibold">
              <span>
                {step}. {label}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-muted">{cards.length}</span>
            </h3>
            {cards.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Nobody at this step</p>
            ) : (
              cards.map((v) => {
                const over = (v.daysOpen ?? 0) > dash.targetDays;
                return (
                  <article key={v.provider.uid} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">
                    <div>
                      <ProviderLink id={v.provider.id}>{v.name}</ProviderLink>
                      <p className="text-xs text-muted">
                        {v.provider.specialty} · {v.provider.location}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Mono className={over ? "text-red" : "text-ink"}>{v.daysOpen ?? "–"} days</Mono>
                      {over && <Chip tone="bad">Over target</Chip>}
                      {v.currentRow?.waitingOnProvider && <Chip tone="warn">Waiting on provider</Chip>}
                    </div>
                    {v.currentRow?.waitingOn && <p className="text-xs text-body">Waiting on {v.currentRow.waitingOn}</p>}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => actions.advance(v.provider.id)}
                        className="min-h-9 rounded-md border border-accent px-3 text-xs font-semibold text-accent hover:bg-info-bg"
                      >
                        {step < 4 ? "Complete step · move on" : "Complete credentialing"}
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}

export function CredentialingView() {
  const { dash } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  const { options, idOf } = useProviderOptions();
  const [view, setView] = useState<"board" | "table">("board");
  const [showDone, setShowDone] = useState(false);
  const rows = dash.credentialingLines.filter((l) => showDone || !l.completed);
  const tab = (v: "board" | "table", text: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={cx("min-h-10 rounded-md px-4 text-sm font-semibold", view === v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}
    >
      {text}
    </button>
  );
  return (
    <>
      <PageHeader title="Credentialing" crumb="Credentialing" />
      <Card title="Credentialing pipeline" headingId="cred-steps-heading" aside={`${dash.inProgress.length} in progress`}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="View" className="flex gap-1 rounded-lg bg-page p-1">
            {tab("board", "Board")}
            {tab("table", "Table")}
          </div>
          {view === "table" && (
            <label className="flex min-h-10 items-center gap-2.5 text-sm">
              <input type="checkbox" className={checkbox} checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Include finished steps
            </label>
          )}
        </div>
        {canEdit && <EditHint />}
        {view === "board" ? (
          <Board />
        ) : (
          <>
            {canEdit && (
              <div className="mb-4">
                <AddForm
                  buttonLabel="Add credentialing step"
                  title="Add credentialing step"
                  fields={[
                    { key: "provider", label: "Provider", type: "select", options, required: true },
                    { key: "step", label: "Step", type: "select", options: CREDENTIAL_STEPS.map((s, i) => `${i + 1}. ${s}`) },
                    { key: "started", label: "Started", type: "date", required: true, initial: dash.today },
                  ]}
                  onSubmit={(v) =>
                    actions.add("credentialing", { providerId: idOf(v.provider), step: Number(v.step[0]), startedDate: v.started, completedDate: null, waitingOn: "", waitingOnProvider: false })
                  }
                />
              </div>
            )}
            <DataTable
              caption="Credentialing steps"
              empty="No credentialing steps in progress for this selection."
              minWidth={820}
              rows={rows}
              rowKey={(l) => l.uid}
              editing={canEdit}
              rowLabel={(l) => `${l.name}, step ${l.step}`}
              onDelete={(l) => actions.remove("credentialing", l.uid)}
              columns={[
                { header: "Provider", value: (l) => l.name, cell: (l) => <ProviderLink id={l.providerId}>{l.name}</ProviderLink> },
                { header: "Location", value: (l) => l.location, filter: true, cell: (l) => l.location },
                { header: "Step", value: (l) => `${l.step}. ${l.stepLabel}`, filter: true, cell: (l) => `${l.step}. ${l.stepLabel}` },
                {
                  header: "Started",
                  value: (l) => l.started,
                  cell: (l) => formatDate(l.started, dash.today),
                  edit: { type: "date", get: (l) => l.started, set: (l, x) => actions.update("credentialing", l.uid, { startedDate: x }) },
                },
                {
                  header: "Finished",
                  value: (l) => l.completed,
                  cell: (l) => (l.completed ? formatDate(l.completed, dash.today) : <Chip tone="warn">In progress</Chip>),
                  edit: { type: "date", clearable: true, get: (l) => l.completed ?? "", set: (l, x) => actions.update("credentialing", l.uid, { completedDate: x || null }) },
                },
                { header: "Days in step", align: "right", value: (l) => l.days, cell: (l) => <Mono className="text-ink">{l.days}</Mono> },
                {
                  header: "Waiting on",
                  value: (l) => l.waitingOn,
                  cell: (l) => (l.waitingOn ? `${l.waitingOnProvider ? "Provider: " : ""}${l.waitingOn}` : <span className="text-muted">–</span>),
                  edit: { type: "text", clearable: true, get: (l) => l.waitingOn, set: (l, x) => actions.update("credentialing", l.uid, { waitingOn: x }) },
                },
                {
                  header: "Provider's turn?",
                  value: (l) => (l.waitingOnProvider ? "yes" : "no"),
                  cell: (l) => (l.waitingOnProvider ? <Chip tone="warn">Yes</Chip> : <span className="text-muted">No</span>),
                  edit: { type: "select", options: YES_NO, get: (l) => (l.waitingOnProvider ? "yes" : "no"), set: (l, x) => actions.update("credentialing", l.uid, { waitingOnProvider: x === "yes" }) },
                },
              ]}
            />
          </>
        )}
      </Card>
    </>
  );
}

export function ExpirationsView() {
  const { dash } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  const { options, idOf } = useProviderOptions();
  const [windowDays, setWindowDays] = useState("90");
  const limit = windowDays === "all" ? Infinity : Number(windowDays);
  const rows = dash.expirations.filter((e) => e.days <= limit);
  return (
    <>
      <PageHeader title="Licences & expirations" crumb="Licences & expirations" />
      <Card title="Licences, DEA, board certifications, malpractice, BLS/ACLS" headingId="exp-table-heading" aside={`${rows.length} ${rows.length === 1 ? "item" : "items"}`}>
        {canEdit && (
          <>
            <EditHint />
            <div className="mb-4">
              <AddForm
                buttonLabel="Add expiration"
                title="Add expiration"
                fields={[
                  { key: "provider", label: "Provider", type: "select", options, required: true },
                  { key: "item", label: "Item", type: "combo", options: EXPIRY_ITEMS, required: true, initial: "Licence" },
                  { key: "date", label: "Expires", type: "date", required: true },
                ]}
                onSubmit={(v) => actions.add("expirations", { providerId: idOf(v.provider), item: v.item.trim(), expiryDate: v.date })}
              />
            </div>
          </>
        )}
        <label className="mb-3 flex w-fit flex-col gap-1 text-xs font-medium text-muted">
          Show
          <select value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className="min-h-11 rounded-md border border-[#c3cec9] bg-white px-3 py-2 text-sm text-ink">
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
          rowKey={(e) => e.uid}
          editing={canEdit}
          rowLabel={(e) => `${e.name} ${e.item}`}
          onDelete={(e) => actions.remove("expirations", e.uid)}
          columns={[
            { header: "Provider", value: (e) => e.name, cell: (e) => <ProviderLink id={e.providerId}>{e.name}</ProviderLink> },
            { header: "Location", value: (e) => e.location, filter: true, cell: (e) => e.location },
            {
              header: "Item",
              value: (e) => e.item,
              filter: true,
              cell: (e) => e.item,
              edit: { type: "combo", options: EXPIRY_ITEMS, get: (e) => e.item, set: (e, x) => actions.update("expirations", e.uid, { item: x }) },
            },
            {
              header: "Expires",
              value: (e) => e.date,
              cell: (e) => formatDate(e.date, dash.today),
              edit: { type: "date", get: (e) => e.date, set: (e, x) => actions.update("expirations", e.uid, { expiryDate: x }) },
            },
            {
              header: "Time left",
              align: "right",
              value: (e) => e.days,
              cell: (e) => <Mono className={e.days <= 30 ? "text-red" : e.days <= 60 ? "text-amber" : "text-ink"}>{e.days < 0 ? `${-e.days} days ago` : `${e.days} days`}</Mono>,
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
  const { canEdit } = useUi();
  const actions = useActions();
  const payer = dash.stepAverages[2];
  const rows = dash.inProgress.filter((v) => v.currentStep === 3);
  return (
    <>
      <PageHeader title="Payer enrollment" crumb="Payer enrollment" />
      <Card title={`Providers at step 3 of 4 (${CREDENTIAL_STEPS[2]})`} headingId="payer-heading" aside={`${rows.length} ${rows.length === 1 ? "provider" : "providers"}`}>
        <p className="mb-3 text-sm text-body">
          {payer.avgDays === null ? "No finished payer enrollments yet to compare against." : `Finished payer enrollments took ${payer.avgDays} days on average (${payer.count} counted).`}
        </p>
        <DataTable
          caption="Providers in payer enrollment"
          empty="Nobody is at the payer enrollment step for this selection."
          rows={rows}
          rowKey={(v) => v.provider.uid}
          editing={canEdit}
          rowLabel={(v) => v.name}
          columns={[
            { header: "Provider", value: (v) => v.name, cell: (v) => <ProviderLink id={v.provider.id}>{v.name}</ProviderLink> },
            { header: "Location", value: (v) => v.provider.location, filter: true, cell: (v) => v.provider.location },
            { header: "Step started", value: (v) => v.currentRow?.startedDate ?? null, cell: (v) => (v.currentRow ? formatDate(v.currentRow.startedDate, dash.today) : "–") },
            { header: "Days in step", align: "right", value: (v) => v.daysInStep, cell: (v) => <Mono className="text-ink">{v.daysInStep ?? "–"}</Mono> },
            { header: "Days since file opened", align: "right", value: (v) => v.daysOpen, cell: (v) => <Mono className={(v.daysOpen ?? 0) > dash.targetDays ? "text-red" : "text-ink"}>{v.daysOpen ?? "–"}</Mono> },
            {
              header: "Waiting on",
              value: (v) => v.currentRow?.waitingOn ?? "",
              cell: (v) => (v.currentRow?.waitingOn ? `${v.currentRow.waitingOnProvider ? "Provider: " : ""}${v.currentRow.waitingOn}` : <span className="text-muted">–</span>),
              edit: {
                type: "text",
                clearable: true,
                get: (v) => v.currentRow?.waitingOn ?? "",
                set: (v, x) => v.currentRow && actions.update("credentialing", v.currentRow.uid, { waitingOn: x }),
              },
            },
          ]}
        />
      </Card>
    </>
  );
}

export function RecruitingView() {
  const { dash } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  const setStage = (r: Role, i: number, v: string) => {
    const stages = [...r.stages] as Role["stages"];
    stages[i] = toInt(v);
    actions.update("roles", r.uid, { stages });
  };
  return (
    <>
      <PageHeader title="Recruiting" crumb="Recruiting" />
      <Card title="Open roles" headingId="roles-heading" aside={`${dash.roles.length} ${dash.roles.length === 1 ? "role" : "roles"}`}>
        {canEdit && (
          <>
            <EditHint />
            <div className="mb-4">
              <AddForm
                buttonLabel="Add open role"
                title="Add open role"
                fields={[
                  { key: "title", label: "Title", type: "text", required: true },
                  { key: "location", label: "Location", type: "combo", options: dash.locations, required: true },
                  { key: "specialty", label: "Specialty (optional)", type: "combo", options: dash.specialties },
                  { key: "opened", label: "Opened", type: "date", required: true, initial: dash.today },
                ]}
                onSubmit={(v) =>
                  actions.add("roles", { title: v.title.trim(), location: v.location.trim(), specialty: v.specialty.trim(), openedDate: v.opened, stages: [0, 0, 0, 0, 0] })
                }
              />
            </div>
          </>
        )}
        <DataTable
          caption="Open roles and candidates at each stage"
          empty="No open roles for this selection."
          minWidth={960}
          rows={dash.roles}
          rowKey={(r) => r.role.uid}
          editing={canEdit}
          rowLabel={(r) => r.role.title}
          onDelete={(r) => actions.remove("roles", r.role.uid)}
          columns={[
            {
              header: "Role",
              value: (r) => r.role.title,
              cell: (r) => <span className="font-semibold text-ink">{r.role.title}</span>,
              edit: { type: "text", get: (r) => r.role.title, set: (r, x) => actions.update("roles", r.role.uid, { title: x }) },
            },
            {
              header: "Location",
              value: (r) => r.role.location,
              filter: true,
              cell: (r) => r.role.location,
              edit: { type: "combo", options: dash.locations, get: (r) => r.role.location, set: (r, x) => actions.update("roles", r.role.uid, { location: x }) },
            },
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
              edit: { type: "date", get: (r) => r.role.openedDate, set: (r, x) => actions.update("roles", r.role.uid, { openedDate: x }) },
            },
            ...PIPELINE_STAGES.map((stage, i) => ({
              header: stage,
              align: "right" as const,
              value: (r: (typeof dash.roles)[number]) => r.role.stages[i],
              cell: (r: (typeof dash.roles)[number]) => <Mono className="text-ink">{r.role.stages[i]}</Mono>,
              edit: {
                type: "number" as const,
                get: (r: (typeof dash.roles)[number]) => String(r.role.stages[i]),
                set: (r: (typeof dash.roles)[number], x: string) => setStage(r.role, i, x),
              },
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
  const { canEdit } = useUi();
  const actions = useActions();
  const { options, idOf } = useProviderOptions();
  return (
    <>
      <PageHeader title="Onboarding" crumb="Onboarding" />
      <Card title="Providers onboarding" headingId="onboarding-heading" aside={`${dash.onboarding.length} ${dash.onboarding.length === 1 ? "provider" : "providers"}`}>
        {canEdit && (
          <>
            <EditHint />
            <div className="mb-4">
              <AddForm
                buttonLabel="Add onboarding"
                title="Add onboarding"
                fields={[
                  { key: "provider", label: "Provider", type: "select", options, required: true },
                  { key: "start", label: "Start date", type: "date", required: true, initial: dash.today },
                  { key: "total", label: "Total steps", type: "number", required: true, initial: "8" },
                  { key: "next", label: "Next step", type: "text" },
                ]}
                onSubmit={(v) =>
                  actions.add("onboarding", { providerId: idOf(v.provider), startDate: v.start, stepsDone: 0, stepsTotal: Math.max(1, toInt(v.total)), nextStep: v.next.trim() })
                }
              />
            </div>
          </>
        )}
        <DataTable
          caption="Onboarding progress"
          empty="Nobody is onboarding for this selection."
          minWidth={820}
          rows={dash.onboarding}
          rowKey={(o) => o.row.uid}
          editing={canEdit}
          rowLabel={(o) => o.name}
          onDelete={(o) => actions.remove("onboarding", o.row.uid)}
          columns={[
            { header: "Provider", value: (o) => o.name, cell: (o) => <ProviderLink id={o.row.providerId}>{o.name}</ProviderLink> },
            { header: "Location", value: (o) => o.location, filter: true, cell: (o) => o.location },
            {
              header: "Start date",
              value: (o) => o.row.startDate,
              cell: (o) => (
                <>
                  {formatDate(o.row.startDate, dash.today)}
                  <div className="text-xs text-muted">{o.daysToStart > 0 ? `in ${o.daysToStart} days` : o.daysToStart === 0 ? "today" : `${-o.daysToStart} days ago`}</div>
                </>
              ),
              edit: { type: "date", get: (o) => o.row.startDate, set: (o, x) => actions.update("onboarding", o.row.uid, { startDate: x }) },
            },
            {
              header: "Steps done",
              className: "w-[24%]",
              value: (o) => o.pct,
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
              edit: {
                type: "number",
                get: (o) => String(o.row.stepsDone),
                set: (o, x) => actions.update("onboarding", o.row.uid, { stepsDone: Math.min(toInt(x), o.row.stepsTotal) }),
              },
            },
            {
              header: "Total steps",
              align: "right",
              value: (o) => o.row.stepsTotal,
              cell: (o) => <Mono className="text-ink">{o.row.stepsTotal}</Mono>,
              edit: {
                type: "number",
                min: 1,
                get: (o) => String(o.row.stepsTotal),
                set: (o, x) => actions.update("onboarding", o.row.uid, { stepsTotal: Math.max(1, toInt(x)), stepsDone: Math.min(o.row.stepsDone, Math.max(1, toInt(x))) }),
              },
            },
            {
              header: "Next step",
              value: (o) => o.row.nextStep,
              cell: (o) => o.row.nextStep || <span className="text-muted">–</span>,
              edit: { type: "text", clearable: true, get: (o) => o.row.nextStep, set: (o, x) => actions.update("onboarding", o.row.uid, { nextStep: x }) },
            },
          ]}
        />
      </Card>
    </>
  );
}
