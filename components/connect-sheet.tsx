"use client";

import { useState } from "react";
import { checkSheetLink } from "@/app/connect-actions";
import { useActions } from "./dashboard-provider";
import { INPUT } from "./edit-cells";
import { Modal } from "./modal";
import { buildXlsx } from "@/lib/xlsx";
import { todayISO } from "@/lib/dates";
import { buildSeedTabs } from "@/lib/seed-data";

/** The quick way to go live: paste a link-shared Google Sheet and click Connect. No accounts or settings. */
export function ConnectSheetDialog({ onClose }: { onClose: () => void }) {
  const actions = useActions();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    const bytes = buildXlsx(buildSeedTabs(todayISO()) as never);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "med-match-sample-tracker.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Connect a Google Sheet" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await checkSheetLink(link).catch(() => ({ ok: false as const, message: "Could not reach the server. Try again." }));
          if (!res.ok) {
            setBusy(false);
            return setError(res.message);
          }
          actions.connectSheet(res.sheetId); // switches to live data and reloads the dashboard
        }}
      >
        <ol className="flex flex-col gap-2.5 text-sm text-body">
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info-bg text-xs font-bold text-info-fg">1</span>
            <span>
              In Google Sheets click <strong>Share</strong>, then under <strong>General access</strong> choose <strong>Anyone with the link</strong> (Viewer).
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info-bg text-xs font-bold text-info-fg">2</span>
            <span>Paste the sheet&apos;s link below and click Connect.</span>
          </li>
        </ol>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Google Sheet link
          <input className={INPUT} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit" autoFocus />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-[#e4b4ae] bg-red-bg px-3 py-2.5 text-sm text-red-fg">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !link.trim()} className="min-h-11 rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Connecting…" : "Connect"}
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold text-ink hover:bg-page">
            Cancel
          </button>
        </div>
      </form>

      <div className="mt-5 flex flex-col gap-2 rounded-xl bg-page p-4 text-sm text-body">
        <p className="font-semibold text-ink">No sheet yet?</p>
        <p>
          Download the sample workbook, upload it at <strong>drive.google.com</strong> (New → File upload), and open it with Google Sheets. It already has the right tabs and sample data, so you can edit it and see the dashboard follow.
        </p>
        <div>
          <button type="button" onClick={download} className="min-h-10 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold text-ink hover:bg-white">
            Download sample workbook (.xlsx)
          </button>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        Anyone with the link can view a sheet shared this way, so use it for demo or non-sensitive data. For private client data, use the secure connection (Settings → Advanced). Dates in the sheet should look like 2026-10-31.
      </p>
    </Modal>
  );
}
