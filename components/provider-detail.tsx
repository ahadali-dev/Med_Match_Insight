"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActions, useDashboard, useUi } from "./dashboard-provider";
import { DataTable } from "./data-table";
import { EditCell, FormDialog } from "./edit-cells";
import { expirationFields, onboardingFields, providerFields, YES_NO } from "./forms";
import { RowMenu } from "./row-menu";
import { Card, Chip, Mono, ProgressBar, SampleBadge, cx } from "./ui";
import { diffDays, formatDate } from "@/lib/dates";
import { viewProvider } from "@/lib/metrics";
import { CREDENTIAL_STEPS, PROVIDER_STATUSES, type Provider } from "@/lib/types";

const toInt = (v: string) => Math.max(0, Math.round(Number(v) || 0));

function Stat({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,40,30,0.05)]">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="text-2xl font-semibold leading-none">{children}</div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}

/** Full-page profile for one provider: everything the sheet knows about them in one place. */
export function ProviderDetailView({ id }: { id: string }) {
  const { data, dash, client, showSampleBadge } = useDashboard();
  const { canEdit } = useUi();
  const actions = useActions();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "profile" | "onboarding" | "addExpiry" | { expiry: string }>(null);

  const provider = data.providers.find((p) => p.id === id);
  if (!provider) {
    return (
      <div className="flex max-w-lg flex-col gap-3 py-10">
        <h1 className="text-2xl font-bold">Provider not found</h1>
        <p className="text-body">This provider may have been deleted, or the link is wrong.</p>
        <Link href={`/${client.id}/providers`} className="font-semibold">
          Back to all providers
        </Link>
      </div>
    );
  }

  const today = dash.today;
  const view = viewProvider(provider, data.credentialing, today);
  const target = dash.targetDays;
  const items = data.expirations
    .filter((e) => e.providerId === provider.id)
    .map((e) => ({ ...e, days: diffDays(today, e.expiryDate) }))
    .sort((a, b) => a.days - b.days);
  const onboarding = data.onboarding.find((o) => o.providerId === provider.id);
  const nextExpiry = items[0];
  const over = view.daysOpen !== null && view.daysOpen > target;

  const attention: { id: string; tone: "bad" | "warn"; text: string }[] = [];
  for (const e of items.filter((x) => x.days <= 30)) {
    attention.push({ id: e.uid, tone: "bad", text: e.days < 0 ? `${e.item} expired ${-e.days} days ago` : `${e.item} expires in ${e.days} days (${formatDate(e.expiryDate, today)})` });
  }
  if (over) attention.push({ id: "over", tone: "bad", text: `${view.daysOpen} days in credentialing, ${(view.daysOpen ?? 0) - target} over the ${target}-day target` });
  if (view.currentRow?.waitingOnProvider) attention.push({ id: "wait", tone: "warn", text: `Waiting on the provider: ${view.currentRow.waitingOn || "documents"}` });

  const editExpiry = typeof dialog === "object" && dialog ? items.find((e) => e.uid === dialog.expiry) : undefined;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Link href={`/${client.id}/providers`} className="font-semibold">
              ← Providers
            </Link>
            <span aria-hidden="true">/</span>
            <span>{view.name}</span>
            {showSampleBadge && <SampleBadge />}
          </nav>
          <h1 className="text-[28px] font-bold leading-tight">{view.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>{provider.credential}</Chip>
            <Chip>{provider.specialty}</Chip>
            <Chip>{provider.location}</Chip>
            <Chip tone={provider.status === "Ready" ? "good" : "warn"}>{provider.status}</Chip>
            <span className="text-xs text-muted">ID {provider.id}</span>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {view.currentStep && (
              <button type="button" onClick={() => actions.advance(provider.id)} className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark">
                Complete step {view.currentStep}
              </button>
            )}
            {view.rows.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  actions.update("providers", provider.uid, { status: "In credentialing" });
                  actions.add("credentialing", { providerId: provider.id, step: 1, startedDate: today, completedDate: null, waitingOn: "", waitingOnProvider: false }, "Credentialing started.");
                }}
                className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                Start credentialing
              </button>
            )}
            <RowMenu
              label={`Actions for ${view.name}`}
              items={[
                { label: "Edit profile", icon: "edit", onSelect: () => setDialog("profile") },
                {
                  label: "Delete provider",
                  icon: "delete",
                  danger: true,
                  onSelect: () => {
                    actions.remove("providers", provider.uid, `${view.name} deleted.`);
                    router.push(`/${client.id}/providers`);
                  },
                },
              ]}
            />
          </div>
        )}
      </header>

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Stat
          label="Credentialing"
          note={view.totalDays !== null ? `Target ${target} days` : view.currentStep ? `Step ${view.currentStep} of 4 · ${CREDENTIAL_STEPS[view.currentStep - 1]}` : "No file yet"}
        >
          {view.totalDays !== null ? (
            <Mono className={view.totalDays > target ? "text-red" : "text-accent"}>{view.totalDays} days</Mono>
          ) : view.daysOpen !== null ? (
            <Mono className={over ? "text-red" : "text-ink"}>{view.daysOpen} days</Mono>
          ) : (
            "–"
          )}
        </Stat>
        <Stat label="Next expiry" note={nextExpiry ? `${nextExpiry.item}, ${formatDate(nextExpiry.expiryDate, today)}` : "Nothing tracked"}>
          {nextExpiry ? <Mono className={nextExpiry.days <= 30 ? "text-red" : nextExpiry.days <= 60 ? "text-amber" : "text-ink"}>{nextExpiry.days < 0 ? `${-nextExpiry.days} days ago` : `${nextExpiry.days} days`}</Mono> : "–"}
        </Stat>
        <Stat label="Onboarding" note={onboarding ? `Starts ${formatDate(onboarding.startDate, today)}` : "Not onboarding"}>
          {onboarding ? <Mono className="text-ink">{onboarding.stepsDone} of {onboarding.stepsTotal}</Mono> : "–"}
        </Stat>
        <Stat label="Needs attention" note={attention.length === 0 ? "All clear" : "See the list below"}>
          <Mono className={attention.length ? "text-red" : "text-accent"}>{attention.length}</Mono>
        </Stat>
      </section>

      {attention.length > 0 && (
        <Card title="Needs attention" headingId="p-attention">
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-sm">
                <Chip tone={a.tone}>{a.tone === "bad" ? "Urgent" : "Waiting"}</Chip>
                {a.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Credentialing timeline" headingId="p-cred" aside={view.totalDays !== null ? `Finished in ${view.totalDays} days` : view.daysOpen !== null ? `${view.daysOpen} days so far · target ${target}` : undefined}>
          {view.rows.length === 0 ? (
            <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">No credentialing file for this provider.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {CREDENTIAL_STEPS.map((label, i) => {
                const step = i + 1;
                const row = view.rows.find((r) => r.step === step);
                const done = Boolean(row?.completedDate);
                const current = view.currentStep === step;
                const days = row ? Math.max(0, diffDays(row.startedDate, row.completedDate ?? today)) : 0;
                return (
                  <li key={label} className={cx("rounded-xl border p-3.5", current ? "border-accent bg-info-bg" : "border-line")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {step}. {label}
                      </span>
                      <Chip tone={done ? "good" : current ? "warn" : "neutral"}>{done ? "Done" : current ? "In progress" : "Not started"}</Chip>
                    </div>
                    {row && (
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(row.startedDate, today)}
                        {row.completedDate ? ` to ${formatDate(row.completedDate, today)}` : ""} · {days} days{row.completedDate ? "" : " so far"}
                      </p>
                    )}
                    {current && row && !canEdit && row.waitingOn && (
                      <p className="mt-1.5 text-xs text-body">
                        Waiting on: {row.waitingOnProvider ? "provider · " : ""}
                        {row.waitingOn}
                      </p>
                    )}
                    {current && row && canEdit && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem]">
                        <label className="flex flex-col gap-1 text-xs text-muted">
                          Waiting on
                          <EditCell type="text" clearable label="Waiting on" value={row.waitingOn} onCommit={(v) => actions.update("credentialing", row.uid, { waitingOn: v })} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted">
                          Provider&apos;s turn?
                          <EditCell type="select" label="Waiting on the provider" value={row.waitingOnProvider ? "yes" : "no"} options={YES_NO} onCommit={(v) => actions.update("credentialing", row.uid, { waitingOnProvider: v === "yes" })} />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Profile" headingId="p-profile">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {(
                [
                  ["Provider ID", provider.id],
                  ["Credential", provider.credential],
                  ["Specialty", provider.specialty],
                  ["Location", provider.location],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-muted">{k}</dt>
                  <dd className="mt-0.5 text-ink">{v}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs font-medium text-muted">Status</dt>
                <dd className="mt-1">
                  {canEdit ? (
                    <EditCell
                      type="select"
                      label="Status"
                      value={provider.status}
                      options={[...PROVIDER_STATUSES]}
                      onCommit={(v) => actions.update("providers", provider.uid, { status: v as Provider["status"] }, `${view.name} is now ${v}.`)}
                      className="max-w-[14rem]"
                    />
                  ) : (
                    <Chip tone={provider.status === "Ready" ? "good" : "warn"}>{provider.status}</Chip>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card
            title="Onboarding"
            headingId="p-onboarding"
            aside={
              canEdit ? (
                <button type="button" onClick={() => (onboarding ? setDialog("onboarding") : actions.add("onboarding", { providerId: provider.id, startDate: today, stepsDone: 0, stepsTotal: 8, nextStep: "" }, "Onboarding started."))} className="text-[13px] font-semibold text-accent underline">
                  {onboarding ? "Edit" : "Start onboarding"}
                </button>
              ) : undefined
            }
          >
            {onboarding ? (
              <div className="text-sm">
                <p className="mb-2">
                  Starts {formatDate(onboarding.startDate, today)} ({diffDays(today, onboarding.startDate) > 0 ? `in ${diffDays(today, onboarding.startDate)} days` : "started"})
                </p>
                <ProgressBar pct={(onboarding.stepsDone / onboarding.stepsTotal) * 100} label="Onboarding progress" />
                <p className="mt-2 text-xs text-muted">
                  {onboarding.stepsDone} of {onboarding.stepsTotal} steps done{onboarding.nextStep ? ` · next: ${onboarding.nextStep}` : ""}
                </p>
              </div>
            ) : (
              <p className="rounded-md bg-page px-3 py-6 text-center text-sm text-muted">Not in onboarding.</p>
            )}
          </Card>
        </div>
      </div>

      <Card
        title="Licenses & expirations"
        headingId="p-exp"
        aside={`${items.length} ${items.length === 1 ? "item" : "items"}`}
      >
        {canEdit && (
          <div className="mb-4">
            <button type="button" onClick={() => setDialog("addExpiry")} className="flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark">
              <span aria-hidden="true">+</span>Add expiration
            </button>
          </div>
        )}
        <DataTable
          caption={`Licenses and expirations for ${view.name}`}
          controls={false}
          empty="Nothing tracked for this provider yet."
          rows={items}
          rowKey={(e) => e.uid}
          rowLabel={(e) => `${e.item}`}
          minWidth={520}
          columns={[
            { header: "Item", cell: (e) => <span className="font-semibold text-ink">{e.item}</span> },
            { header: "Expires", cell: (e) => formatDate(e.expiryDate, today) },
            { header: "Time left", align: "right", cell: (e) => <Mono className={e.days <= 30 ? "text-red" : e.days <= 60 ? "text-amber" : "text-ink"}>{e.days < 0 ? `${-e.days} days ago` : `${e.days} days`}</Mono> },
            { header: "Flag", cell: (e) => (e.days < 0 ? <Chip tone="bad">Expired</Chip> : e.days <= 30 ? <Chip tone="bad">30 days</Chip> : e.days <= 60 ? <Chip tone="warn">60 days</Chip> : e.days <= 90 ? <Chip>90 days</Chip> : null) },
            ...(canEdit
              ? [
                  {
                    header: "Actions",
                    align: "right" as const,
                    cell: (e: (typeof items)[number]) => (
                      <RowMenu
                        label={`Actions for ${e.item}`}
                        items={[
                          { label: "Edit", icon: "edit", onSelect: () => setDialog({ expiry: e.uid }) },
                          { label: "Delete", icon: "delete", danger: true, onSelect: () => actions.remove("expirations", e.uid) },
                        ]}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      {dialog === "profile" && (
        <FormDialog
          title={`Edit ${view.name}`}
          fields={providerFields(dash.specialties, dash.locations)}
          initial={{ name: provider.name, credential: provider.credential, specialty: provider.specialty, location: provider.location, status: provider.status }}
          onSubmit={(v) => actions.update("providers", provider.uid, { name: v.name.trim(), credential: v.credential, specialty: v.specialty.trim(), location: v.location.trim(), status: v.status as Provider["status"] }, "Profile updated.")}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "onboarding" && onboarding && (
        <FormDialog
          title="Edit onboarding"
          fields={onboardingFields()}
          initial={{ start: onboarding.startDate, done: String(onboarding.stepsDone), total: String(onboarding.stepsTotal), next: onboarding.nextStep }}
          onSubmit={(v) => {
            const total = Math.max(1, toInt(v.total));
            actions.update("onboarding", onboarding.uid, { startDate: v.start, stepsTotal: total, stepsDone: Math.min(toInt(v.done), total), nextStep: v.next.trim() }, "Onboarding updated.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "addExpiry" && (
        <FormDialog
          title="Add expiration"
          submitLabel="Add"
          fields={expirationFields()}
          initial={{ item: "License" }}
          onSubmit={(v) => actions.add("expirations", { providerId: provider.id, item: v.item.trim(), expiryDate: v.date })}
          onClose={() => setDialog(null)}
        />
      )}
      {editExpiry && (
        <FormDialog
          title={`Edit ${editExpiry.item}`}
          fields={expirationFields()}
          initial={{ item: editExpiry.item, date: editExpiry.expiryDate }}
          onSubmit={(v) => actions.update("expirations", editExpiry.uid, { item: v.item.trim(), expiryDate: v.date }, "Expiration updated.")}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
