import { cookies } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ConnectionProblem } from "@/components/connection-problem";
import { DashboardProvider } from "@/components/dashboard-provider";
import { Shell } from "@/components/shell";
import { getClients, hasSheet } from "@/lib/clients";
import { buildDemoData } from "@/lib/demo-data";
import { describeError } from "@/lib/errors";
import { getSheetData } from "@/lib/get-sheet-data";
import { credentialsConfigured } from "@/lib/google-sheets";
import { SHEET_ID_PATTERN } from "@/lib/sheet-id";
import { sheetCookie, sourceCookie } from "@/lib/source";

function Loading() {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[288px_minmax(0,1fr)]">
      <div className="hidden bg-sidebar lg:block" />
      <div role="status" className="flex min-h-dvh items-center justify-center px-4 text-sm text-muted">
        Loading workspace…
      </div>
    </div>
  );
}

async function ClientShell({ params, children }: { params: LayoutProps<"/[client]">["params"]; children: ReactNode }) {
  const { client: clientId } = await params;
  // Everything below depends on the current time and the visitor's cookie, so render at request time.
  await connection();

  let clients;
  try {
    clients = getClients();
  } catch (err) {
    const { code, message } = describeError(err);
    return <ConnectionProblem code={code} message={message} />;
  }
  const client = clients.find((c) => c.id === clientId);
  if (!client) notFound();
  const summaries = clients.map((c) => ({ id: c.id, name: c.name }));

  const sheetConfigured = hasSheet(client);
  const credsOk = credentialsConfigured();

  // Two ways to have a live sheet: (1) the visitor pasted a link-shared sheet ("Connect a Google Sheet"),
  // (2) the server has CLIENTS + service account credentials. A pasted link wins.
  const jar = await cookies();
  const linkCookie = jar.get(sheetCookie(client.id))?.value ?? "";
  const linkedSheet = SHEET_ID_PATTERN.test(linkCookie) ? linkCookie : "";
  const liveAvailable = Boolean(linkedSheet) || (sheetConfigured && credsOk);
  const liveHint = liveAvailable ? "" : "Connect a Google Sheet to see live data.";

  // A connected sheet is the default. The visitor can switch to the demo workspace in the UI;
  // that choice is remembered in a cookie. With no sheet connected, the demo workspace is used.
  const chosen = jar.get(sourceCookie(client.id))?.value;
  const wantsLive = liveAvailable && (chosen === "live" || chosen !== "demo");

  let data;
  if (wantsLive) {
    // Read on every page load; the data layer caches this for at most 60 seconds.
    const result = await getSheetData(client.id, linkedSheet);
    if (!result.ok) return <ConnectionProblem code={result.code} message={result.message} clients={summaries} clientId={client.id} />;
    data = result.data;
  } else {
    data = buildDemoData(client.name);
  }

  return (
    <DashboardProvider
      key={`${client.id}-${wantsLive ? "live" : "demo"}`}
      client={{ id: client.id, name: client.name }}
      clients={summaries}
      initialData={data}
      initialServerTime={new Date().toISOString()}
      showSampleBadge={process.env.SAMPLE_DATA_BADGE !== "false"}
      mode={wantsLive ? "live" : "demo"}
      liveAvailable={liveAvailable}
      liveHint={liveHint}
      linkedSheet={Boolean(linkedSheet)}
    >
      <Shell>{children}</Shell>
    </DashboardProvider>
  );
}

export default function ClientLayout({ children, params }: LayoutProps<"/[client]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ClientShell params={params}>{children}</ClientShell>
    </Suspense>
  );
}
