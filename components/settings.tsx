"use client";

import { useActions, useDashboard } from "./dashboard-provider";
import { EditCell } from "./edit-cells";
import { PageHeader } from "./page-header";
import { Card, Chip, cx } from "./ui";

export function SettingsView() {
  const { data, mode, liveAvailable, liveHint, client } = useDashboard();
  const actions = useActions();
  const seg = (active: boolean) =>
    cx("min-h-11 flex-1 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50", active ? "bg-accent text-white" : "text-body hover:bg-white");

  return (
    <>
      <PageHeader title="Settings" crumb="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Workspace" headingId="ws-heading">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Client name
              {mode === "demo" ? (
                <EditCell type="text" label="Client name" value={data.config.clientName} onCommit={(v) => actions.setConfig({ clientName: v })} className="max-w-sm" />
              ) : (
                <span className="text-sm font-medium text-ink">{data.config.clientName}</span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Target days to credential
              {mode === "demo" ? (
                <EditCell type="number" min={1} label="Target days to credential" value={String(data.config.targetDays)} onCommit={(v) => actions.setConfig({ targetDays: Math.max(1, Number(v)) })} />
              ) : (
                <span className="font-mono text-sm font-semibold text-ink">{data.config.targetDays}</span>
              )}
            </label>
            <p className="text-sm text-muted">
              {mode === "demo"
                ? "The target drives the red days, the overdue alerts and the on-time percentage everywhere in the dashboard."
                : "These come from the Config tab of the Google Sheet. Change them there."}
            </p>
          </div>
        </Card>

        <Card title="Data source" headingId="ds-heading">
          <div className="flex flex-col gap-4">
            <div role="group" aria-label="Choose data source" className="flex gap-1 rounded-xl bg-page p-1">
              <button type="button" aria-pressed={mode === "demo"} onClick={() => mode !== "demo" && actions.setSource("demo")} className={seg(mode === "demo")}>
                Demo data
              </button>
              <button type="button" aria-pressed={mode === "live"} disabled={!liveAvailable} title={liveAvailable ? undefined : liveHint} onClick={() => mode !== "live" && actions.setSource("live")} className={seg(mode === "live")}>
                Google Sheet
              </button>
            </div>
            {mode === "demo" ? (
              <>
                <p className="text-sm text-body">
                  You are in the <strong>demo workspace</strong>. Everything is editable and saved in this browser only, so you can show the product without touching any real data.
                </p>
                <div>
                  <button type="button" onClick={() => actions.resetDemo()} className="min-h-11 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold hover:bg-page">
                    Reset demo data
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-body">
                You are reading <strong>{data.source.title}</strong> live. The connection is read-only: edit the sheet itself and the dashboard picks it up on the next refresh.
              </p>
            )}
            {!liveAvailable && <p className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-fg">{liveHint}</p>}
          </div>
        </Card>

        <Card title="Connect a Google Sheet" headingId="connect-heading" className="lg:col-span-2">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-body">
            <li>Create a service account in Google Cloud, enable the Sheets API, and download its JSON key.</li>
            <li>
              Set <code className="rounded bg-page px-1">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and <code className="rounded bg-page px-1">GOOGLE_PRIVATE_KEY</code> in your environment variables.
            </li>
            <li>Share the client&apos;s sheet with that email as Viewer.</li>
            <li>
              Add the sheet ID to <code className="rounded bg-page px-1">CLIENTS</code>, then switch this workspace to <Chip>Google Sheet</Chip>.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted">Client: {client.name}. Full steps and the sheet layout are in the README.</p>
        </Card>
      </div>
    </>
  );
}
