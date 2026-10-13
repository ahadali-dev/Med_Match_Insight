import type { Metadata } from "next";
import { CredentialingView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Credentialing" };

export default function Page() {
  return <CredentialingView />;
}
