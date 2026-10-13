import type { Metadata } from "next";
import { Suspense } from "react";
import { ProviderDetailView } from "@/components/provider-detail";

export const metadata: Metadata = { title: "Provider" };

async function Detail({ params }: { params: PageProps<"/[client]/providers/[id]">["params"] }) {
  const { id } = await params;
  return <ProviderDetailView id={decodeURIComponent(id)} />;
}

export default function Page({ params }: PageProps<"/[client]/providers/[id]">) {
  return (
    <Suspense fallback={<div role="status" className="py-10 text-sm text-muted">Loading provider…</div>}>
      <Detail params={params} />
    </Suspense>
  );
}
