import { describe, it, expect } from 'vitest';
import { plural } from '../plural';

// Intl.PluralRules routes `count` through the locale's CLDR plural
// categories. fr-CA buckets 0 and 1 under `one`, while en-CA reserves
// `one` strictly for exactly 1 — drift here would misgender every
// count-bearing label in the UI.
describe('plural', () => {
  const FR_FORMS = { one: '{count} article', other: '{count} articles' };
  const EN_FORMS = { one: '{count} item', other: '{count} items' };

  it('picks `one` for count=1 in both fr and en', () => {
    expect(plural(1, FR_FORMS, 'fr')).toBe('1 article');
    expect(plural(1, EN_FORMS, 'en')).toBe('1 item');
  });

  it('picks `one` for count=0 in fr but `other` in en', () => {
    // French folds 0 into the `one` category; English does not.
    expect(plural(0, FR_FORMS, 'fr')).toBe('0 article');
    expect(plural(0, EN_FORMS, 'en')).toBe('0 items');
  });

  it('picks `other` for count=N (>1) in both locales', () => {
    expect(plural(5, FR_FORMS, 'fr')).toBe('5 articles');
    expect(plural(42, EN_FORMS, 'en')).toBe('42 items');
  });

  it('honors an explicit zero override regardless of locale bucketing', () => {
    // Copy may want "Aucun article" for the empty state even though fr
    // would normally emit "0 article".
    const forms = {
      zero: 'Aucun article',
      one: '{count} article',
      other: '{count} articles',
    };
    expect(plural(0, forms, 'fr')).toBe('Aucun article');
    expect(plural(0, { ...forms, zero: 'No items' }, 'en')).toBe('No items');
  });

  it('substitutes {count} in the selected template', () => {
    expect(plural(3, { one: '{count} x', other: '{count} xs' }, 'en')).toBe(
      '3 xs',
    );
  });

  it('defaults to fr when no lang is passed', () => {
    // Site default is fr-CA; omitting the lang arg must match fr output.
    expect(plural(0, FR_FORMS)).toBe('0 article');
    expect(plural(1, FR_FORMS)).toBe('1 article');
  });
});
