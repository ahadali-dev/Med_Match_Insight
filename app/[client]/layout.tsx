import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ConnectionProblem } from "@/components/connection-problem";
import { DashboardProvider } from "@/components/dashboard-provider";
import { Shell } from "@/components/shell";
import { getClients } from "@/lib/clients";
import { describeError } from "@/lib/errors";
import { getSheetData } from "@/lib/get-sheet-data";

function Loading() {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <div className="hidden bg-sidebar lg:block" />
      <div role="status" className="flex min-h-dvh items-center justify-center px-4 text-sm text-muted">
        Reading the Google Sheet…
      </div>
    </div>
  );
}

async function ClientShell({ params, children }: { params: LayoutProps<"/[client]">["params"]; children: ReactNode }) {
  const { client: clientId } = await params;

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

  // Read on every page load; the data layer caches this for at most 60 seconds.
  const result = await getSheetData(client.id);
  if (!result.ok) return <ConnectionProblem code={result.code} message={result.message} clients={summaries} />;
  const data = result.data;

  return (
    <DashboardProvider
      key={client.id}
      client={{ id: client.id, name: client.name }}
      clients={summaries}
      initialData={data}
      initialServerTime={new Date().toISOString()}
      showSampleBadge={process.env.SAMPLE_DATA_BADGE !== "false"}
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
