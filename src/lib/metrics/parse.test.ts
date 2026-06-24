import { describe, it, expect } from 'vitest';
import { parseMetrics } from './parse';

const valid = {
  currency: 'USD',
  points: [{ date: '2026-06-12', cost: 44.36, cpa: 12.1, roi: 161.47, conversions: 36 }],
};

describe('parseMetrics', () => {
  it('parses a valid dataset', () => {
    expect(parseMetrics(valid)).toEqual(valid);
  });

  it('defaults currency to USD when missing', () => {
    const { points } = valid;
    expect(parseMetrics({ points }).currency).toBe('USD');
  });

  it('accepts an empty points array', () => {
    expect(parseMetrics({ currency: 'USD', points: [] }).points).toEqual([]);
  });

  it('throws when a required field is missing', () => {
    const bad = {
      currency: 'USD',
      points: [{ date: '2026-06-12', cost: 44.36, cpa: 12.1, roi: 161.47 }],
    };
    expect(() => parseMetrics(bad)).toThrow(/Invalid metrics data/);
  });

  it('throws when a field has the wrong type', () => {
    const bad = {
      currency: 'USD',
      points: [{ date: '2026-06-12', cost: 'x', cpa: 12.1, roi: 161.47, conversions: 36 }],
    };
    expect(() => parseMetrics(bad)).toThrow(/Invalid metrics data/);
  });

  it('throws when the date format is invalid', () => {
    const bad = {
      currency: 'USD',
      points: [{ date: '12.06.2026', cost: 44.36, cpa: 12.1, roi: 161.47, conversions: 36 }],
    };
    expect(() => parseMetrics(bad)).toThrow(/Invalid metrics data/);
  });
});
