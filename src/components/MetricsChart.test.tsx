// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsChart } from './MetricsChart';
import { useECharts } from '@/hooks/useECharts';
import type { MetricsDataset } from '@/lib/metrics/types';

vi.mock('@/hooks/useECharts', () => ({
  useECharts: vi.fn(() => ({ current: null })),
}));

const dataset: MetricsDataset = {
  currency: 'USD',
  points: [{ date: '2026-06-12', cost: 44.36, cpa: 12.1, roi: 161.47, conversions: 36 }],
};

beforeEach(() => vi.clearAllMocks());

describe('MetricsChart', () => {
  it('shows an upload prompt when dataset is null', () => {
    render(<MetricsChart dataset={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Загрузите JSON/);
    expect(vi.mocked(useECharts).mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('shows an upload prompt when points are empty', () => {
    render(<MetricsChart dataset={{ currency: 'USD', points: [] }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Загрузите JSON/);
    expect(vi.mocked(useECharts).mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('passes a 4-series option to useECharts when data is present', () => {
    render(<MetricsChart dataset={dataset} />);
    const lastCall = vi.mocked(useECharts).mock.calls.at(-1)?.[0];
    expect(lastCall).not.toBeNull();
    expect((lastCall?.series as unknown[]).length).toBe(4);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
