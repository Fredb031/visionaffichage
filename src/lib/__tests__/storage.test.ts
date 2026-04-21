import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readLS, writeLS } from '../storage';

// readLS / writeLS are the synchronous guard rails that stop a corrupt
// localStorage entry from crashing the admin shell on first paint.
// These tests simulate the three real-world failure modes:
//   1. key absent → fallback returned
//   2. malformed JSON left over from an older build → fallback returned
//   3. quota-exceeded on write → returns false, doesn't throw
describe('readLS', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the fallback when the key is missing', () => {
    expect(readLS('missing-key', { seeded: true })).toEqual({ seeded: true });
    expect(readLS<number[]>('missing-array', [])).toEqual([]);
  });

  it('returns the parsed value when the key holds valid JSON', () => {
    localStorage.setItem('good', JSON.stringify({ a: 1, b: [2, 3] }));
    expect(readLS('good', null)).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns the fallback when the stored JSON is malformed', () => {
    // Older builds or a hand-edited devtools entry can leave garbage
    // behind; must not throw synchronously during hydration.
    localStorage.setItem('bad', '{not json');
    expect(readLS('bad', 'safe')).toBe('safe');
  });

  it('returns the fallback when the stored JSON parses to null', () => {
    // JSON.parse('null') is legal and returns null — readLS must still
    // honor the caller's fallback so consumers can rely on non-null.
    localStorage.setItem('null-blob', 'null');
    expect(readLS('null-blob', { default: true })).toEqual({ default: true });
  });
});

describe('writeLS', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a serializable value and returns true', () => {
    expect(writeLS('key', { a: 1 })).toBe(true);
    expect(localStorage.getItem('key')).toBe('{"a":1}');
  });

  it('returns false (never throws) when setItem hits a quota exception', () => {
    // Safari private mode and quota-full mobile origins throw
    // QuotaExceededError synchronously on setItem.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(() => writeLS('k', { big: 'x' })).not.toThrow();
    expect(writeLS('k', { big: 'x' })).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it('returns false when the value contains a circular reference', () => {
    // JSON.stringify throws on cycles — same silent-fallback contract.
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(writeLS('cycle', cycle)).toBe(false);
  });
});
