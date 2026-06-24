// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function mockFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('MetricsChart', () => {
  it('shows a loading state initially', () => {
    mockFetch(() => new Promise(() => {})); // никогда не резолвится
    render(<MetricsChart />);
    expect(screen.getByRole('status')).toHaveTextContent(/Загрузка/);
  });

  it('passes the built option (4 series) to useECharts on success', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(dataset) }),
    );
    render(<MetricsChart />);
    await waitFor(() => {
      const lastCall = vi.mocked(useECharts).mock.calls.at(-1)?.[0];
      expect(lastCall).not.toBeNull();
      expect((lastCall?.series as unknown[]).length).toBe(4);
    });
  });

  it('shows an error state and retries on click', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    render(<MetricsChart />);
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();

    // повторный запрос — теперь успешный
    mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(dataset) }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Повторить/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows an empty state when there are no points', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ currency: 'USD', points: [] }),
      }),
    );
    render(<MetricsChart />);
    await waitFor(() => expect(screen.getByText(/Нет данных/)).toBeInTheDocument());
  });
});
