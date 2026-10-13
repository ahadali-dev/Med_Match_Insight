import type { Metadata } from "next";
import { ProvidersView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Providers" };

export default function Page() {
  return <ProvidersView />;
}
