/**
 * i18n configuration — coverage tests
 */
import { describe, it, expect } from 'vitest';

describe('i18n configuration', () => {
  it('exports i18n instance with expected methods', async () => {
    const i18n = (await import('@/i18n')).default;
    expect(i18n).toBeDefined();
    expect(typeof i18n.t).toBe('function');
    expect(typeof i18n.changeLanguage).toBe('function');
  });

  it('has English loaded', async () => {
    const i18n = (await import('@/i18n')).default;
    expect(i18n.language).toBeDefined();
  });

  it('t function returns strings', async () => {
    const i18n = (await import('@/i18n')).default;
    const result = i18n.t('common.loading');
    expect(typeof result).toBe('string');
  });
});
