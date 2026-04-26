import { describe, it, expect } from 'vitest';
import { fmtMoney } from '../format';

// fmtMoney defends downstream UI from two failure modes at once:
//  1. NaN / null / undefined prices (Shopify variants occasionally ship
//     without a `price` field; we render an em-dash instead of "NaN").
//  2. Locale-blind `.toFixed(2)` output — fr-CA customers must see
//     comma decimals ("27,54 $") while en-CA sees "$27.54".
// These tests pin both behaviors so any future "quick fix" that reaches
// for `.toFixed` or drops the NaN guard fails the suite.
describe('fmtMoney', () => {
  it('returns em-dash for null / undefined / NaN / Infinity', () => {
    expect(fmtMoney(null)).toBe('—');
    expect(fmtMoney(undefined)).toBe('—');
    expect(fmtMoney(NaN)).toBe('—');
    expect(fmtMoney(Infinity)).toBe('—');
    expect(fmtMoney(-Infinity)).toBe('—');
  });

  it('formats zero in both locales without losing the currency symbol', () => {
    // fr-CA groups "0,00 $" with a NBSP before the $; en-CA uses "$0.00".
    // We assert the digits + symbol rather than NBSP to stay robust against
    // ICU version drift.
    const fr = fmtMoney(0, 'fr');
    const en = fmtMoney(0, 'en');
    expect(fr).toMatch(/0,00/);
    expect(fr).toContain('$');
    expect(en).toMatch(/\$0\.00/);
  });

  it('formats typical positive amounts with locale-aware decimals', () => {
    expect(fmtMoney(27.54, 'fr')).toMatch(/27,54/);
    expect(fmtMoney(27.54, 'en')).toMatch(/\$27\.54/);
  });

  it('formats negative amounts (refunds, credits)', () => {
    // Refund rows on AdminOrders rely on fmtMoney keeping the minus
    // sign — it shouldn't silently absolute-value the number.
    const fr = fmtMoney(-12.5, 'fr');
    const en = fmtMoney(-12.5, 'en');
    expect(fr).toMatch(/12,50/);
    expect(fr).toMatch(/-|−|\(/); // minus, unicode minus, or accounting parens
    expect(en).toMatch(/12\.50/);
    expect(en).toMatch(/-|−|\(/);
  });

  it('renders negative-zero as a plain zero (no leading minus)', () => {
    // Discount math like (subtotal - subtotal) yields -0 in JS; without the
    // guard Intl prints "-$0.00" / "-0,00 $" which looks like a refund bug.
    const fr = fmtMoney(-0, 'fr');
    const en = fmtMoney(-0, 'en');
    expect(fr).not.toMatch(/-|−/);
    expect(en).not.toMatch(/-|−/);
    expect(fr).toMatch(/0,00/);
    expect(en).toMatch(/\$0\.00/);
  });

  it('defaults to fr-CA when no lang is passed', () => {
    // Default locale for the site is fr-CA; an unspecified lang must not
    // accidentally flip to en-CA or the UA default.
    expect(fmtMoney(1.99)).toMatch(/1,99/);
  });
});
