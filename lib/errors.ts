export type SheetErrorCode =
  | "no_clients"
  | "unknown_client"
  | "missing_credentials"
  | "not_shared"
  | "not_found"
  | "missing_tab"
  | "bad_schema"
  | "rate_limited"
  | "api";

/** An error with a message that is safe (and useful) to show on screen. */
export class SheetError extends Error {
  code: SheetErrorCode;
  constructor(code: SheetErrorCode, message: string) {
    super(message);
    this.name = "SheetError";
    this.code = code;
  }
}

export function describeError(err: unknown): { code: SheetErrorCode; message: string } {
  if (err instanceof SheetError) return { code: err.code, message: err.message };
  return { code: "api", message: "Could not read the Google Sheet. Check the server logs for details." };
}
