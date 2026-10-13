import { todayISO } from "./dates";
import { parseSheet } from "./parse-sheet";
import { buildSeedTabs } from "./seed-data";
import { TAB_NAMES, type SheetData } from "./types";

/** The pristine editable demo workspace for a client, built from the fake seed data. */
export function buildDemoData(clientName: string, now: Date = new Date()): SheetData {
  const data = parseSheet(
    buildSeedTabs(todayISO(now)),
    { kind: "demo", title: "Demo workspace", url: null, tabCount: TAB_NAMES.length },
    now.toISOString(),
  );
  return { ...data, config: { ...data.config, clientName } };
}
