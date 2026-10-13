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
import { sourceCookie } from "@/lib/source";

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
  const liveAvailable = sheetConfigured && credsOk;
  const liveHint = !sheetConfigured
    ? "Add this client's sheetId to the CLIENTS environment variable to enable Live."
    : !credsOk
      ? "Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY to enable Live."
      : "";

  // Demo is the default. Live is chosen in the UI and remembered in a cookie.
  const jar = await cookies();
  const wantsLive = sheetConfigured && jar.get(sourceCookie(client.id))?.value === "live";

  let data;
  if (wantsLive) {
    // Read on every page load; the data layer caches this for at most 60 seconds.
    const result = await getSheetData(client.id);
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
