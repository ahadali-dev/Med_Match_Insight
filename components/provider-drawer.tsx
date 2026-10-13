"use client";

import { useEffect, useRef } from "react";
import { useActions, useDashboard, useUi } from "./dashboard-provider";
import { EditCell } from "./edit-cells";
import { Chip, Mono, ProgressBar, cx } from "./ui";
import { diffDays, formatDate } from "@/lib/dates";
import { viewProvider } from "@/lib/metrics";
import { CREDENTIAL_STEPS, PROVIDER_STATUSES } from "@/lib/types";

/** Slide-over profile for one provider: credentialing timeline, expirations, onboarding. */
export function ProviderDrawer() {
  const { openProviderId, openProvider, canEdit } = useUi();
  const { data, dash } = useDashboard();
  const actions = useActions();
  const ref = useRef<HTMLDialogElement>(null);

  const provider = openProviderId ? data.providers.find((p) => p.id === openProviderId) : undefined;
  const open = Boolean(provider);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const view = provider ? viewProvider(provider, data.credentialing, dash.today) : null;
  const expirations = provider
    ? data.expirations.filter((e) => e.providerId === provider.id).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    : [];
  const onboarding = provider ? data.onboarding.find((o) => o.providerId === provider.id) : undefined;
  const today = dash.today;

  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClose={() => openProvider(null)}
      onClick={(e) => {
        if (e.target === ref.current) openProvider(null);
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(480px,100vw)] max-w-none overflow-y-auto bg-card p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      {provider && view && (
        <div className="flex min-h-full flex-col gap-5 p-5">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="drawer-title" className="text-xl font-bold">
                {view.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {provider.specialty} · {provider.location}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip>{provider.credential}</Chip>
                <Chip tone={provider.status === "Ready" ? "good" : "warn"}>{provider.status}</Chip>
                <Chip>{provider.id}</Chip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openProvider(null)}
              className="min-h-10 shrink-0 rounded-md border border-[#c3cec9] px-3 text-sm font-semibold hover:bg-page"
            >
              Close
            </button>
          </header>

          {canEdit && (
            <section aria-label="Edit provider" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-page p-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Status
                <EditCell
                  type="select"
                  label="Status"
                  value={provider.status}
                  options={[...PROVIDER_STATUSES]}
                  onCommit={(v) => actions.update("providers", provider.uid, { status: v as typeof provider.status }, "Status updated.")}
                  className="w-44"
                />
              </label>
              {view.currentStep && (
                <button
                  type="button"
                  onClick={() => actions.advance(provider.id)}
                  className="min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
                >
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
                  className="min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"
                >
                  Start credentialing
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  actions.remove("providers", provider.uid, `${view.name} deleted.`);
                  openProvider(null);
                }}
                className="min-h-10 rounded-md border border-[#e4b4ae] bg-white px-4 text-sm font-semibold text-red hover:bg-red-bg"
              >
                Delete provider
              </button>
            </section>
          )}

          <section aria-labelledby="d-cred">
            <h3 id="d-cred" className="mb-2 text-sm font-semibold">
              Credentialing
              {view.totalDays !== null && <span className="ml-2 font-normal text-muted">finished in {view.totalDays} days</span>}
              {view.daysOpen !== null && (
                <span className={cx("ml-2 font-normal", view.daysOpen > dash.targetDays ? "text-red" : "text-muted")}>
                  {view.daysOpen} days so far (target {dash.targetDays})
                </span>
              )}
            </h3>
            {view.rows.length === 0 ? (
              <p className="rounded-md bg-page px-3 py-4 text-sm text-muted">No credentialing file for this provider.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {CREDENTIAL_STEPS.map((label, i) => {
                  const step = i + 1;
                  const row = view.rows.find((r) => r.step === step);
                  const done = Boolean(row?.completedDate);
                  const current = view.currentStep === step;
                  return (
                    <li key={label} className={cx("rounded-lg border p-3", current ? "border-accent bg-info-bg" : "border-line")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {step}. {label}
                        </span>
                        <Chip tone={done ? "good" : current ? "warn" : "neutral"}>{done ? "Done" : current ? "In progress" : "Not started"}</Chip>
                      </div>
                      {row && (
                        <p className="mt-1 text-xs text-muted">
                          {formatDate(row.startedDate, today)}
                          {row.completedDate
                            ? ` to ${formatDate(row.completedDate, today)} · ${diffDays(row.startedDate, row.completedDate)} days`
                            : ` · ${Math.max(0, diffDays(row.startedDate, today))} days so far`}
                        </p>
                      )}
                      {current && row && !canEdit && row.waitingOn && (
                        <p className="mt-1 text-xs text-body">
                          Waiting on: {row.waitingOnProvider ? "provider · " : ""}
                          {row.waitingOn}
                        </p>
                      )}
                      {current && row && canEdit && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem]">
                          <label className="flex flex-col gap-1 text-xs text-muted">
                            Waiting on
                            <EditCell type="text" clearable label="Waiting on" value={row.waitingOn} onCommit={(v) => actions.update("credentialing", row.uid, { waitingOn: v })} />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-muted">
                            Provider?
                            <EditCell
                              type="select"
                              label="Waiting on the provider"
                              value={row.waitingOnProvider ? "yes" : "no"}
                              options={["yes", "no"]}
                              onCommit={(v) => actions.update("credentialing", row.uid, { waitingOnProvider: v === "yes" })}
                            />
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section aria-labelledby="d-exp">
            <h3 id="d-exp" className="mb-2 text-sm font-semibold">
              Licences &amp; expirations
            </h3>
            {expirations.length === 0 ? (
              <p className="rounded-md bg-page px-3 py-4 text-sm text-muted">Nothing tracked yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {expirations.map((e) => {
                  const days = diffDays(today, e.expiryDate);
                  return (
                    <li key={e.uid} className="flex items-center justify-between gap-3 rounded-md bg-[#f6f8f7] px-3 py-2 text-sm">
                      <span className="font-medium">{e.item}</span>
                      {canEdit ? (
                        <EditCell type="date" label={`${e.item} expiry date`} value={e.expiryDate} onCommit={(v) => actions.update("expirations", e.uid, { expiryDate: v })} className="w-40" />
                      ) : (
                        <span className="text-right">
                          <Mono className={days <= 30 ? "text-red" : days <= 60 ? "text-amber" : "text-ink"}>{days < 0 ? `${-days} days ago` : `${days} days`}</Mono>
                          <span className="block text-xs text-muted">{formatDate(e.expiryDate, today)}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {onboarding && (
            <section aria-labelledby="d-onb">
              <h3 id="d-onb" className="mb-2 text-sm font-semibold">
                Onboarding
              </h3>
              <div className="rounded-lg border border-line p-3 text-sm">
                <p className="mb-1.5">
                  Starts {formatDate(onboarding.startDate, today)} · <Mono className="text-ink">{onboarding.stepsDone} of {onboarding.stepsTotal}</Mono> steps done
                </p>
                <ProgressBar pct={(onboarding.stepsDone / onboarding.stepsTotal) * 100} label="Onboarding progress" />
                {onboarding.nextStep && <p className="mt-2 text-xs text-muted">Next: {onboarding.nextStep}</p>}
                {canEdit && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    Steps done
                    <EditCell type="number" label="Onboarding steps done" value={String(onboarding.stepsDone)} min={0} onCommit={(v) => actions.update("onboarding", onboarding.uid, { stepsDone: Math.min(Number(v), onboarding.stepsTotal) })} />
                  </label>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </dialog>
  );
}
