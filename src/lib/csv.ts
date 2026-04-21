// Shared CSV builder for the admin surface.
//
// Every export button in /admin (orders, commissions, analytics, …)
// should route through here so we get one consistent policy:
//
//  - RFC 4180 escaping: wrap every field in double quotes, double any
//    internal quote. This keeps Excel, Numbers, and Google Sheets
//    happy even when a cell contains commas, newlines, or quotes.
//  - CSV-injection safety: prefix values starting with `=`, `+`, `-`,
//    `@`, TAB, or CR with a literal TAB so Excel/Sheets treat them as
//    text instead of executing them as formulas. A customer surname
//    like "@Brown" would otherwise trigger a lookup; a product type
//    named "=SUM(A1:A99)" would execute on open.
//  - UTF-8 BOM: prefix the blob with \ufeff so Excel-on-Windows renders
//    Québécois accents (é, è, à, ô, …) instead of mojibake. macOS
//    Numbers and modern LibreOffice ignore the BOM.
//  - \r\n line endings: Windows-friendly; Unix tools strip the CR.
//
// The helper is deliberately tiny — consumers build their own row
// arrays and filenames — so it can be swapped into any of the existing
// exporters without a rewrite.
//
// Lives in lib/ (not a page-level util) because the exporters on
// AdminAnalytics, AdminOrders, commissions.ts, and VendorDashboard
// should all share the same escape rules; drift between them would
// mean a cell rendered as a formula in one export and as text in
// another.

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/** A single raw CSV cell before escaping — anything String-coercible, a
 *  Date (rendered as ISO-8601), or nullish (rendered as an empty cell). */
export type CsvCell = string | number | boolean | Date | null | undefined;

/** A row of raw CSV cells. Handy for typing admin exporters that build
 *  rows before handing them to {@link buildCsv} or {@link downloadCsv}. */
export type CsvRow = ReadonlyArray<CsvCell>;

/** Escape a single CSV field per RFC 4180 with CSV-injection guard.
 *  null/undefined → empty string so downstream spreadsheets render an
 *  empty cell instead of the literal text "null"/"undefined". Date
 *  values are rendered as ISO-8601 (`toISOString()`) so exports sort
 *  lexically and round-trip cleanly; everything else falls through to
 *  `String()` (covers number, boolean, objects with custom toString). */
export function csvEscape(value: unknown): string {
  let s: string;
  if (value === null || value === undefined) {
    s = '';
  } else if (value instanceof Date) {
    // Invalid dates stringify to "Invalid Date" and isoString throws —
    // fall back to empty so one bad row can't blow up the whole export.
    s = Number.isNaN(value.getTime()) ? '' : value.toISOString();
  } else {
    s = String(value);
  }
  if (FORMULA_TRIGGERS.test(s)) s = '\t' + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Build a CSV string from a 2D array of rows. Each row is an array of
 *  raw cells (any type — coerced via String()). Rows are joined with
 *  \r\n for Excel-on-Windows friendliness; Unix tools strip the CR. */
export function buildCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}

/** Build a CSV blob (UTF-8 + BOM) ready to hand to URL.createObjectURL.
 *  The BOM makes Excel-on-Windows open Québécois accents correctly. */
export function buildCsvBlob(rows: ReadonlyArray<ReadonlyArray<unknown>>): Blob {
  return new Blob(['\ufeff' + buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
}

/** Trigger a browser download for `rows` under `filename`. No-op outside
 *  the browser (SSR / test runners where `document` is undefined). */
export function downloadCsv(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  filename: string,
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = buildCsvBlob(rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so Safari has time to start the download before the
  // blob URL is garbage-collected. 1s is generous but invisible.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build a filename like `vision-<slug>-YYYY-MM-DD.csv` using the
 *  caller's local date. Centralised so every chart/report export gets
 *  a consistent naming pattern — finance can grep `vision-*` to find
 *  every admin export in their Downloads folder. */
export function csvFilename(slug: string, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `vision-${slug}-${y}-${m}-${d}.csv`;
}
