import type { Metadata } from "next";
import { ExpirationsView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Licences & expirations" };

export default function Page() {
  return <ExpirationsView />;
}
