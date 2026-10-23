import { describe, expect, it } from 'vitest';
import { NIGERIA_STATES, normalizeState } from './assets';

describe('normalizeState', () => {
  it('maps spellings onto the canonical list', () => {
    expect(normalizeState('lagos')).toBe('Lagos');
    expect(normalizeState('Abuja')).toBe('FCT');
    expect(normalizeState('akwa-ibom')).toBe('Akwa Ibom');
  });
  it('rejects combined or unknown states', () => {
    expect(normalizeState('Adamawa and Taraba')).toBeNull();
    expect(normalizeState('')).toBeNull();
  });
  it('has the same 37 states as the backend', () => {
    expect(NIGERIA_STATES).toHaveLength(37);
    expect(NIGERIA_STATES).toContain('FCT');
  });
});
