"use client";

import { useState } from "react";
import { useActions, useDashboard, useUi } from "./dashboard-provider";
import { DataTable } from "./data-table";
import { AddForm, type FormField } from "./edit-cells";
import { EXPIRY_ITEMS, YES_NO, providerFields } from "./forms";
import { PageHeader } from "./page-header";
import { ProviderLink } from "./provider-link";
import { Card, Chip, Mono, ProgressBar, cx } from "./ui";
import { formatDate } from "@/lib/dates";
import { displayName } from "@/lib/metrics";
import { CREDENTIAL_STEPS, PIPELINE_STAGES, PROVIDER_STATUSES, type Role } from "@/lib/types";

const checkbox = "size-5 accent-[#1a6b4a]";

const toInt = (v: string) => Math.max(0, Math.round(Number(v) || 0));
function useProviderOptions() {
  const { data } = useDashboard();
  const options = data.providers.map((p) => `${p.id} · ${displayName(p)}`);
  return { options, idOf: (label: string) => label.split(" · ")[0] };
}

export function ProvidersView() {
  const { dash } = useDashboard();
  const { canEdit, openProvider } = useUi();
  const actions = useActions();
  const rows = [...dash.providers].sort((a, b) => a.provider.name.localeCompare(b.provider.name));
  const fields = providerFields(dash.specialties, dash.locations);
  return (
    <>
      <PageHeader title="Providers" crumb="Providers" />
      <Card title="All providers" headingId="providers-heading" aside={`${rows.length} ${rows.length === 1 ? "provider" : "providers"}`}>
        {canEdit && (
          <div className="mb-4">
            <AddForm
              buttonLabel="Add provider"
              title="Add provider"
              fields={[...fields.filter((f) => f.key !== "status"), { key: "start", label: "Start credentialing now?", type: "select", options: YES_NO, initial: "yes" }]}
              onSubmit={(v) => actions.addProvider({ name: v.name.trim(), credential: v.credential, specialty: v.specialty.trim(), location: v.location.trim() }, v.start === "yes")}
            />
          </div>
        )}
        <DataTable
          caption="Providers"
          empty="No providers match these filters."
          rows={rows}
          rowKey={(v) => v.provider.uid}
          rowLabel={(v) => v.name}
          minWidth={760}
          actions={{
            details: (v) => openProvider(v.provider.id),
            edit: {
              fields,
              values: (v) => ({ name: v.provider.name, credential: v.provider.credential, specialty: v.provider.specialty, location: v.provider.location, status: v.provider.status }),
              submit: (v, x) =>
                actions.update("providers", v.provider.uid, { name: x.name.trim(), credential: x.credential, specialty: x.specialty.trim(), location: x.location.trim(), status: x.status as (typeof PROVIDER_STATUSES)[number] }, "Provider updated."),
            },
            remove: (v) => actions.remove("providers", v.provider.uid, `${v.name} deleted.`),
          }}
          columns={[
            { header: "Name", value: (v) => v.provider.name, cell: (v) => <ProviderLink id={v.provider.id}>{v.name}</ProviderLink> },
            { header: "Credential", value: (v) => v.provider.credential, filter: true, cell: (v) => v.provider.credential },
            { header: "Specialty", value: (v) => v.provider.specialty, filter: true, cell: (v) => v.provider.specialty },
            { header: "Location", value: (v) => v.provider.location, filter: true, cell: (v) => v.provider.location },
            {
              header: "Status",
              value: (v) => v.provider.status,
              filter: true,
              cell: (v) => <Chip tone={v.provider.status === "Ready" ? "good" : "warn"}>{v.provider.status}</Chip>,
              quick: {
                type: "select",
                options: [...PROVIDER_STATUSES],
                get: (v) => v.provider.status,
                set: (v, x) => actions.update("providers", v.provider.uid, { status: x as (typeof PROVIDER_STATUSES)[number] }, `${v.name} is now ${x}.`),
              },
            },
          ]}
        />
      </Card>
    </>
  );
}

const STEP_NAMES = [...CREDENTIAL_STEPS, "Finished"];

function Board() {
  const { dash } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStep, setOverStep] = useState<number | null>(null);

  const moveTo = (providerId: string, name: string, from: number | null, target: number) => {
    if (from === target) return;
    actions.move(providerId, target, target === 5 ? `${name} finished credentialing and moved to Onboarding.` : `${name} moved to ${STEP_NAMES[target - 1]}.`);
  };

  // Everyone whose four steps are all dated lives in Finished, newest first.
  const finished = dash.providers
    .filter((v) => v.completedDate)
    .sort((a, b) => (b.completedDate as string).localeCompare(a.completedDate as string) || a.name.localeCompare(b.name));
  const columns = 5;
  return (
    <>
      {canEdit && <p className="mb-3 text-sm text-muted">Drag a card to another column to move that provider. Dragging right completes the steps in between; dragging left reopens a step.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: columns }, (_, i) => i + 1).map((step) => {
          const finishedCol = step === 5;
          const cards = finishedCol ? finished : dash.inProgress.filter((v) => v.currentStep === step);
          const active = dragId !== null && overStep === step;
          return (
            <section
              key={step}
              aria-label={finishedCol ? "Finished" : `Step ${step}: ${CREDENTIAL_STEPS[step - 1]}`}
              onDragOver={(e) => {
                if (!canEdit || !dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStep !== step) setOverStep(step);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStep((s) => (s === step ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setOverStep(null);
                setDragId(null);
                const v = dash.providers.find((x) => x.provider.id === id);
                if (v) moveTo(v.provider.id, v.name, v.currentStep ?? 5, step);
              }}
              className={cx(
                "flex min-h-40 min-w-0 flex-col gap-2.5 rounded-xl p-3 transition-colors",
                active ? "bg-info-bg outline-2 outline-dashed outline-accent" : "bg-page",
              )}
            >
              <h3 className="flex items-center justify-between text-sm font-semibold">
                <span>{finishedCol ? "Finished" : `${step}. ${CREDENTIAL_STEPS[step - 1]}`}</span>
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-muted">{cards.length}</span>
              </h3>
              {cards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                  {finishedCol ? "Finished files stay here. Drop a card to complete credentialing; the provider moves to Onboarding." : canEdit ? "Drop a card here" : "Nobody at this step"}
                </p>
              ) : (
                <div className={cx("flex flex-col gap-2.5", finishedCol && "max-h-[34rem] overflow-y-auto pr-0.5")}>
                {cards.map((v) => {
                  const done = Boolean(v.completedDate);
                  const over = done ? (v.totalDays ?? 0) > dash.targetDays : (v.daysOpen ?? 0) > dash.targetDays;
                  const dragging = dragId === v.provider.id;
                  return (
                    <article
                      key={v.provider.uid}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", v.provider.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(v.provider.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStep(null);
                      }}
                      className={cx(
                        "flex flex-col gap-2 rounded-lg border border-line bg-white p-3 shadow-sm",
                        canEdit && "cursor-grab active:cursor-grabbing",
                        dragging && "opacity-40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <ProviderLink id={v.provider.id}>{v.name}</ProviderLink>
                          <p className="text-xs text-muted">
                            {v.provider.specialty} · {v.provider.location}
                          </p>
                        </div>
                        {canEdit && (
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#7b8d85" className="mt-0.5 shrink-0">
                            <circle cx="9" cy="6" r="1.6" />
                            <circle cx="15" cy="6" r="1.6" />
                            <circle cx="9" cy="12" r="1.6" />
                            <circle cx="15" cy="12" r="1.6" />
                            <circle cx="9" cy="18" r="1.6" />
                            <circle cx="15" cy="18" r="1.6" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Mono className={over ? "text-red" : "text-ink"}>{done ? v.totalDays : (v.daysOpen ?? "–")} days</Mono>
                        {over && <Chip tone="bad">Over target</Chip>}
                        {done && <Chip tone={v.provider.status === "Ready" ? "good" : "warn"}>{v.provider.status}</Chip>}
                        {!done && v.currentRow?.waitingOnProvider && <Chip tone="warn">Waiting on provider</Chip>}
                      </div>
                      {done && v.completedDate && <p className="text-xs text-muted">Finished {formatDate(v.completedDate, dash.today)}</p>}
                      {!done && v.currentRow?.waitingOn && <p className="text-xs text-body">Waiting on {v.currentRow.waitingOn}</p>}
                      {canEdit && (
                        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
                          Move to
                          <select
                            aria-label={`Move ${v.name} to`}
                            value={String(step)}
                            onChange={(e) => moveTo(v.provider.id, v.name, v.currentStep ?? 5, Number(e.target.value))}
                            className="min-h-9 rounded-md border border-[#c3cec9] bg-white px-2 py-1 text-xs text-ink"
                          >
                            {STEP_NAMES.map((n, idx) => (
                              <option key={n} value={idx + 1}>
                                {idx < 4 ? `${idx + 1}. ${n}` : n}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </article>
                  );
                })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
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
              minWidth={900}
              rows={rows}
              rowKey={(l) => l.uid}
              rowLabel={(l) => `${l.name}, step ${l.step}`}
              actions={{
                providerId: (l) => l.providerId,
                edit: {
                  fields: [
                    { key: "started", label: "Started", type: "date", required: true },
                    { key: "finished", label: "Finished (leave empty if in progress)", type: "date" },
                    { key: "waitingOn", label: "Waiting on", type: "text" },
                    { key: "turn", label: "Waiting on the provider?", type: "select", options: YES_NO },
                  ],
                  values: (l) => ({ started: l.started, finished: l.completed ?? "", waitingOn: l.waitingOn, turn: l.waitingOnProvider ? "yes" : "no" }),
                  submit: (l, x) => actions.update("credentialing", l.uid, { startedDate: x.started, completedDate: x.finished || null, waitingOn: x.waitingOn.trim(), waitingOnProvider: x.turn === "yes" }, "Step updated."),
                },
                remove: (l) => actions.remove("credentialing", l.uid),
              }}
              columns={[
                { header: "Provider", value: (l) => l.name, cell: (l) => <ProviderLink id={l.providerId}>{l.name}</ProviderLink> },
                { header: "Location", value: (l) => l.location, filter: true, cell: (l) => l.location },
                { header: "Step", value: (l) => `${l.step}. ${l.stepLabel}`, filter: true, cell: (l) => `${l.step}. ${l.stepLabel}` },
                { header: "Started", value: (l) => l.started, cell: (l) => formatDate(l.started, dash.today) },
                { header: "Finished", value: (l) => l.completed, cell: (l) => (l.completed ? formatDate(l.completed, dash.today) : <Chip tone="warn">In progress</Chip>) },
                { header: "Days in step", align: "right", value: (l) => l.days, cell: (l) => <Mono className="text-ink">{l.days}</Mono> },
                { header: "Waiting on", value: (l) => l.waitingOn, cell: (l) => (l.waitingOn ? `${l.waitingOnProvider ? "Provider: " : ""}${l.waitingOn}` : <span className="text-muted">–</span>) },
                {
                  header: "Provider's turn?",
                  value: (l) => (l.waitingOnProvider ? "yes" : "no"),
                  cell: (l) => (l.waitingOnProvider ? <Chip tone="warn">Yes</Chip> : <span className="text-muted">No</span>),
                  quick: { type: "select", options: YES_NO, get: (l) => (l.waitingOnProvider ? "yes" : "no"), set: (l, x) => actions.update("credentialing", l.uid, { waitingOnProvider: x === "yes" }) },
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
      <PageHeader title="Licenses & expirations" crumb="Licenses & expirations" />
      <Card title="Licenses, DEA, board certifications, malpractice, BLS/ACLS" headingId="exp-table-heading" aside={`${rows.length} ${rows.length === 1 ? "item" : "items"}`}>
        {canEdit && (
          <div className="mb-4">
            <AddForm
              buttonLabel="Add expiration"
              title="Add expiration"
              fields={[
                { key: "provider", label: "Provider", type: "select", options, required: true },
                { key: "item", label: "Item", type: "combo", options: EXPIRY_ITEMS, required: true, initial: "License" },
                { key: "date", label: "Expires", type: "date", required: true },
              ]}
              onSubmit={(v) => actions.add("expirations", { providerId: idOf(v.provider), item: v.item.trim(), expiryDate: v.date })}
            />
          </div>
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
          rowLabel={(e) => `${e.name} ${e.item}`}
          actions={{
            providerId: (e) => e.providerId,
            edit: {
              fields: [
                { key: "item", label: "Item", type: "combo", options: EXPIRY_ITEMS, required: true },
                { key: "date", label: "Expires", type: "date", required: true },
              ],
              values: (e) => ({ item: e.item, date: e.date }),
              submit: (e, x) => actions.update("expirations", e.uid, { item: x.item.trim(), expiryDate: x.date }, "Expiration updated."),
            },
            remove: (e) => actions.remove("expirations", e.uid),
          }}
          columns={[
            { header: "Provider", value: (e) => e.name, cell: (e) => <ProviderLink id={e.providerId}>{e.name}</ProviderLink> },
            { header: "Location", value: (e) => e.location, filter: true, cell: (e) => e.location },
            {
              header: "Item",
              value: (e) => e.item,
              filter: true,
              cell: (e) => e.item,
            },
            {
              header: "Expires",
              value: (e) => e.date,
              cell: (e) => formatDate(e.date, dash.today),
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
  const { openProvider } = useUi();
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
          rowLabel={(v) => v.name}
          actions={{
            details: (v) => openProvider(v.provider.id),
            edit: {
              fields: [
                { key: "waitingOn", label: "Waiting on", type: "text" },
                { key: "turn", label: "Waiting on the provider?", type: "select", options: YES_NO },
              ],
              values: (v) => ({ waitingOn: v.currentRow?.waitingOn ?? "", turn: v.currentRow?.waitingOnProvider ? "yes" : "no" }),
              submit: (v, x) => v.currentRow && actions.update("credentialing", v.currentRow.uid, { waitingOn: x.waitingOn.trim(), waitingOnProvider: x.turn === "yes" }, "Payer step updated."),
            },
          }}
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
  const stageFields: FormField[] = PIPELINE_STAGES.map((st) => ({ key: st, label: `${st} (candidates)`, type: "number", initial: "0" }));
  const baseFields: FormField[] = [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "location", label: "Location", type: "combo", options: dash.locations, required: true },
    { key: "specialty", label: "Specialty (optional)", type: "combo", options: dash.specialties },
    { key: "opened", label: "Opened", type: "date", required: true, initial: dash.today },
  ];
  const stagesOf = (v: Record<string, string>) => PIPELINE_STAGES.map((st) => toInt(v[st])) as Role["stages"];
  return (
    <>
      <PageHeader title="Recruiting" crumb="Recruiting" />
      <Card title="Open roles" headingId="roles-heading" aside={`${dash.roles.length} ${dash.roles.length === 1 ? "role" : "roles"}`}>
        {canEdit && (
          <div className="mb-4">
            <AddForm
              buttonLabel="Add open role"
              title="Add open role"
              fields={[...baseFields, ...stageFields]}
              onSubmit={(v) => actions.add("roles", { title: v.title.trim(), location: v.location.trim(), specialty: v.specialty.trim(), openedDate: v.opened, stages: stagesOf(v) })}
            />
          </div>
        )}
        <DataTable
          caption="Open roles and candidates at each stage"
          empty="No open roles for this selection."
          minWidth={1000}
          rows={dash.roles}
          rowKey={(r) => r.role.uid}
          rowLabel={(r) => r.role.title}
          actions={{
            edit: {
              fields: [...baseFields, ...stageFields],
              values: (r) => ({
                title: r.role.title,
                location: r.role.location,
                specialty: r.role.specialty,
                opened: r.role.openedDate,
                ...Object.fromEntries(PIPELINE_STAGES.map((st, i) => [st, String(r.role.stages[i])])),
              }),
              submit: (r, v) =>
                actions.update("roles", r.role.uid, { title: v.title.trim(), location: v.location.trim(), specialty: v.specialty.trim(), openedDate: v.opened, stages: stagesOf(v) }, "Role updated."),
            },
            remove: (r) => actions.remove("roles", r.role.uid),
          }}
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
  const { canEdit } = useUi();
  const actions = useActions();
  const { options, idOf } = useProviderOptions();
  return (
    <>
      <PageHeader title="Onboarding" crumb="Onboarding" />
      <Card title="Providers onboarding" headingId="onboarding-heading" aside={`${dash.onboarding.length} ${dash.onboarding.length === 1 ? "provider" : "providers"}`}>
        {canEdit && (
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
              onSubmit={(v) => actions.add("onboarding", { providerId: idOf(v.provider), startDate: v.start, stepsDone: 0, stepsTotal: Math.max(1, toInt(v.total)), nextStep: v.next.trim() })}
            />
          </div>
        )}
        <DataTable
          caption="Onboarding progress"
          empty="Nobody is onboarding for this selection."
          minWidth={900}
          rows={dash.onboarding}
          rowKey={(o) => o.row.uid}
          rowLabel={(o) => o.name}
          actions={{
            providerId: (o) => o.row.providerId,
            edit: {
              fields: [
                { key: "start", label: "Start date", type: "date", required: true },
                { key: "done", label: "Steps done", type: "number", required: true },
                { key: "total", label: "Total steps", type: "number", required: true },
                { key: "next", label: "Next step", type: "text" },
              ],
              values: (o) => ({ start: o.row.startDate, done: String(o.row.stepsDone), total: String(o.row.stepsTotal), next: o.row.nextStep }),
              submit: (o, v) => {
                const total = Math.max(1, toInt(v.total));
                actions.update("onboarding", o.row.uid, { startDate: v.start, stepsTotal: total, stepsDone: Math.min(toInt(v.done), total), nextStep: v.next.trim() }, "Onboarding updated.");
              },
            },
            remove: (o) => actions.remove("onboarding", o.row.uid),
          }}
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
            },
            { header: "Next step", value: (o) => o.row.nextStep, cell: (o) => o.row.nextStep || <span className="text-muted">–</span> },
          ]}
        />
      </Card>
    </>
  );
}
