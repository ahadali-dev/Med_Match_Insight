import type { Metadata } from "next";
import { OnboardingView } from "@/components/table-pages";

export const metadata: Metadata = { title: "Onboarding" };

export default function Page() {
  return <OnboardingView />;
}
