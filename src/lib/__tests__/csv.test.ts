import { describe, it, expect } from 'vitest';
import { csvEscape, buildCsv } from '../csv';

// csvEscape is the single policy that protects every admin export from:
//  - RFC 4180 breakage: unquoted commas/quotes/newlines corrupt rows.
//  - CSV injection: values starting with = + - @ TAB CR are executed as
//    formulas by Excel/Sheets on open, which has been a real exfil vector
//    (e.g. "=HYPERLINK(...)"). The fix is to prefix with a literal TAB so
//    the cell is rendered as text.
describe('csvEscape', () => {
  it('wraps plain values in double quotes', () => {
    expect(csvEscape('hello')).toBe('"hello"');
    expect(csvEscape(42)).toBe('"42"');
  });

  it('coerces null/undefined to an empty quoted cell', () => {
    // Prevents the literal string "null" / "undefined" from showing up
    // in spreadsheets when a row has missing fields.
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
  });

  it('preserves commas inside a quoted field', () => {
    expect(csvEscape('Montreal, QC')).toBe('"Montreal, QC"');
  });

  it('doubles internal double-quotes per RFC 4180', () => {
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('neutralises formula leaders = + - @ with a TAB prefix', () => {
    // Each of these would execute in Excel/Sheets if left unescaped.
    expect(csvEscape('=SUM(A1:A99)')).toBe('"\t=SUM(A1:A99)"');
    expect(csvEscape('+1-555-0100')).toBe('"\t+1-555-0100"');
    expect(csvEscape('-12')).toBe('"\t-12"');
    expect(csvEscape('@Brown')).toBe('"\t@Brown"');
  });

  it('neutralises TAB and CR leaders too', () => {
    // Less common but still on the OWASP CSV-injection leader list.
    expect(csvEscape('\tfoo')).toBe('"\t\tfoo"');
    expect(csvEscape('\rfoo')).toBe('"\t\rfoo"');
  });

  it('leaves interior formula characters alone', () => {
    // Only the *leading* char triggers the formula guard.
    expect(csvEscape('a=b')).toBe('"a=b"');
    expect(csvEscape('x+y')).toBe('"x+y"');
  });

  it('buildCsv joins cells with commas and rows with CRLF', () => {
    const out = buildCsv([
      ['name', 'email'],
      ['Jean, Paul', 'jp@example.com'],
    ]);
    expect(out).toBe('"name","email"\r\n"Jean, Paul","jp@example.com"');
  });
});
