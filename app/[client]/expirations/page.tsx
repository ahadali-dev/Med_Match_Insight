import type { Metadata } from "next";
import { ExpirationsView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Licenses & expirations" };

export default function Page() {
  return <ExpirationsView />;
}
