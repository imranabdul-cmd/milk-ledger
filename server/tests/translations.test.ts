import { describe, it, expect } from 'vitest';
import { translations } from '../../client/src/i18n/translations';

describe('i18n Translations Coverage', () => {
  it('has identical keys across en, ta, and ml without missing entries', () => {
    const enKeys = Object.keys(translations.en);
    const taKeys = Object.keys(translations.ta);
    const mlKeys = Object.keys(translations.ml);

    expect(taKeys.length).toBe(enKeys.length);
    expect(mlKeys.length).toBe(enKeys.length);

    for (const key of enKeys) {
      expect((translations.ta as any)[key], `Missing TA key: ${key}`).toBeDefined();
      expect((translations.ta as any)[key].trim().length, `Empty TA key: ${key}`).toBeGreaterThan(0);

      expect((translations.ml as any)[key], `Missing ML key: ${key}`).toBeDefined();
      expect((translations.ml as any)[key].trim().length, `Empty ML key: ${key}`).toBeGreaterThan(0);
    }
  });
});
