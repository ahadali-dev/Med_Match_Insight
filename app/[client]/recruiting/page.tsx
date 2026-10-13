import type { Metadata } from "next";
import { RecruitingView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Recruiting" };

export default function Page() {
  return <RecruitingView />;
}
