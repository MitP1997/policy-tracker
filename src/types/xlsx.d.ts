declare module "xlsx" {
  interface WorkSheet {
    [cell: string]: unknown;
  }
  interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  function read(data: Uint8Array, opts: { type: "array" }): WorkBook;
  const utils: {
    sheet_to_json<T = Record<string, unknown>>(sheet: WorkSheet, opts?: { header?: number }): T[];
  };
}
