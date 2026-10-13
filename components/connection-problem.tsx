"use client";

import Link from "next/link";
import type { SheetErrorCode } from "@/lib/errors";

const HELP: Record<SheetErrorCode, string[]> = {
  no_clients: [
    "Add a CLIENTS environment variable listing each client's name and Google Sheet ID.",
  ],
  unknown_client: ["Pick a client from the list below."],
  missing_credentials: [
    "Create a service account in Google Cloud and download its JSON key.",
    "Set GOOGLE_SERVICE_ACCOUNT_EMAIL to its client_email and GOOGLE_PRIVATE_KEY to its private_key.",
  ],
  not_shared: ["Open the Google Sheet, click Share, and add the service account email as a Viewer."],
  not_found: ["Check the sheetId for this client. It is the long string between /d/ and /edit in the sheet's URL."],
  missing_tab: ["Rename the tabs to match exactly: Providers, Credentialing, Expirations, Roles, Onboarding, Config."],
  bad_schema: ["Fix the column headers in row 1 of the tab named above."],
  rate_limited: ["Wait a minute, then try again."],
  api: ["Try again in a moment. If it keeps failing, check the server logs."],
};

export function ConnectionProblem({
  code,
  message,
  clients = [],
  clientId,
}: {
  code: SheetErrorCode;
  message: string;
  clients?: { id: string; name: string }[];
  /** When set, offers a way back to the demo workspace. */
  clientId?: string;
}) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          MM
        </span>
        <span className="text-[15px] font-bold">Med Match Client Dashboards</span>
      </div>
      <div role="alert" className="rounded-[10px] border border-line bg-card p-6">
        <h1 className="text-2xl font-bold">Can&apos;t load this dashboard yet</h1>
        <p className="mt-2 text-[15px] text-body">{message}</p>
        <h2 className="mt-5 text-sm font-semibold">What to do</h2>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-body">
          {HELP[code].map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 min-h-11 rounded-md bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          Try again
        </button>
        {clientId && (
          <button
            type="button"
            onClick={() => {
              document.cookie = `mm-source-${clientId}=demo; path=/; max-age=31536000; SameSite=Lax`;
              window.location.reload();
            }}
            className="ml-2 mt-5 min-h-11 rounded-md border border-[#c3cec9] bg-white px-5 text-sm font-semibold text-ink hover:bg-page"
          >
            Use the demo workspace instead
          </button>
        )}
      </div>
      {clients.length > 1 && (
        <nav aria-label="Other clients" className="text-sm">
          <h2 className="mb-1 font-semibold">Other clients</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/${c.id}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}
