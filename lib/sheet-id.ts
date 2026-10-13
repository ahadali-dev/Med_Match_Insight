export const SHEET_ID_PATTERN = /^[a-zA-Z0-9_-]{20,}$/;

/** Pulls the sheet ID out of a full Google Sheets URL, or accepts the bare ID. */
export function extractSheetId(input: string): string | null {
  const text = input.trim();
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{15,})/.exec(text);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : null;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
