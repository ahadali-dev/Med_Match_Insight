/** Which data source a client's dashboard uses. Chosen in the UI and remembered in a cookie so the server can read it. */
export type SourceMode = "demo" | "live";

export const sourceCookie = (clientId: string) => `mm-source-${clientId}`;

/** Cookie holding the ID of a link-shared Google Sheet the visitor connected with "Connect a Google Sheet". */
export const sheetCookie = (clientId: string) => `mm-sheet-${clientId}`;
