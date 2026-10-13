import type { FormField } from "./edit-cells";
import { PROVIDER_STATUSES } from "@/lib/types";

export const CREDENTIALS = ["MD", "RN", "CRNA", "NP"];
export const EXPIRY_ITEMS = ["License", "DEA", "Board certification", "Malpractice", "BLS/ACLS"];
export const YES_NO = ["yes", "no"];

export function providerFields(specialties: string[], locations: string[]): FormField[] {
  return [
    { key: "name", label: "Name (e.g. J. Smith)", type: "text", required: true },
    { key: "credential", label: "Credential", type: "select", options: CREDENTIALS },
    { key: "specialty", label: "Specialty", type: "combo", options: specialties, required: true },
    { key: "location", label: "Location", type: "combo", options: locations, required: true },
    { key: "status", label: "Status", type: "select", options: [...PROVIDER_STATUSES] },
  ];
}

export const expirationFields = (): FormField[] => [
  { key: "item", label: "Item", type: "combo", options: EXPIRY_ITEMS, required: true },
  { key: "date", label: "Expires", type: "date", required: true },
];

export const onboardingFields = (): FormField[] => [
  { key: "start", label: "Start date", type: "date", required: true },
  { key: "done", label: "Steps done", type: "number", required: true },
  { key: "total", label: "Total steps", type: "number", required: true },
  { key: "next", label: "Next step", type: "text" },
];
