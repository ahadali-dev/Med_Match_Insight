import type { Metadata } from "next";
import { PayerEnrollmentView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Payer enrollment" };

export default function Page() {
  return <PayerEnrollmentView />;
}
