"use client";

import { useState } from "react";
import { useActions, useDashboard } from "./dashboard-provider";
import { EditCell } from "./edit-cells";
import { PageHeader } from "./page-header";
import { AdminTools } from "./admin-tools";
import { ConnectSheetDialog } from "./connect-sheet";
import { Card, cx } from "./ui";

export function SettingsView() {
  const { data, mode, liveAvailable, linkedSheet } = useDashboard();
  const actions = useActions();
  const [connectOpen, setConnectOpen] = useState(false);
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
              <button type="button" aria-pressed={mode === "live"} onClick={() => (liveAvailable ? mode !== "live" && actions.setSource("live") : setConnectOpen(true))} className={seg(mode === "live")}>
                Google Sheet
              </button>
            </div>
            {mode === "demo" ? (
              <p className="text-sm text-body">
                You are in the <strong>demo workspace</strong>. Everything is editable and saved in this browser only, so you can show the product without touching any real data.
              </p>
            ) : (
              <p className="text-sm text-body">
                You are reading <strong>{data.source.title}</strong> live. The connection is read-only: edit the sheet itself and the dashboard picks it up on the next refresh.
              </p>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setConnectOpen(true)} className="min-h-11 rounded-md bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-dark">
                {linkedSheet ? "Change Google Sheet" : "Connect a Google Sheet"}
              </button>
              {linkedSheet && (
                <button type="button" onClick={() => actions.disconnectSheet()} className="min-h-11 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold hover:bg-page">
                  Disconnect
                </button>
              )}
              {mode === "demo" && (
                <button type="button" onClick={() => actions.resetDemo()} className="min-h-11 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold hover:bg-page">
                  Reset demo data
                </button>
              )}
            </div>
            <p className="text-xs text-muted">Paste a link to a Google Sheet shared as “Anyone with the link”. It takes about a minute, and no accounts or settings are needed.</p>
          </div>
          {connectOpen && <ConnectSheetDialog onClose={() => setConnectOpen(false)} />}
        </Card>

        <details className="group rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(16,40,30,0.05)] lg:col-span-2">
          <summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-semibold marker:hidden">
            Advanced: secure connection for private client data
            <span className="ml-2 text-xs font-normal text-muted">service account, for production</span>
          </summary>
          <div className="px-1 pb-1">
            <AdminTools />
          </div>
        </details>
      </div>
    </>
  );
}
