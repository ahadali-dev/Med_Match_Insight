import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ConnectionProblem } from "@/components/connection-problem";
import { getClients } from "@/lib/clients";
import { describeError } from "@/lib/errors";

async function FirstClient() {
  await connection();
  let first;
  try {
    first = getClients()[0];
  } catch (err) {
    const { code, message } = describeError(err);
    return <ConnectionProblem code={code} message={message} />;
  }
  redirect(`/${first.id}`);
}

export default function Home() {
  return (
    <Suspense fallback={<div role="status" className="p-8 text-sm text-muted">Loading…</div>}>
      <FirstClient />
    </Suspense>
  );
}
