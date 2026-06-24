// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonUploadForm } from './JsonUploadForm';
import type { MetricsDataset } from '@/lib/metrics/types';

const dataset: MetricsDataset = {
  currency: 'USD',
  points: [{ date: '2026-06-12', cost: 44.36, cpa: 12.1, roi: 161.47, conversions: 36 }],
};

function mockFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('JsonUploadForm', () => {
  it('renders a file input and the «Загрузить JSON» button', () => {
    render(<JsonUploadForm onLoaded={() => {}} />);
    expect(screen.getByRole('button', { name: 'Загрузить JSON' })).toBeInTheDocument();
    expect(screen.getByLabelText('JSON-файл')).toBeInTheDocument();
  });

  it('uploads the file and calls onLoaded with the dataset', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(dataset) }),
    );
    const onLoaded = vi.fn();
    render(<JsonUploadForm onLoaded={onLoaded} />);
    const file = new File([JSON.stringify(dataset)], 'metrics.json', {
      type: 'application/json',
    });
    await userEvent.upload(screen.getByLabelText('JSON-файл'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить JSON' }));
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith(dataset));
  });

  it('shows an error message and does not call onLoaded on failure', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Невалидный JSON' }),
      }),
    );
    const onLoaded = vi.fn();
    render(<JsonUploadForm onLoaded={onLoaded} />);
    await userEvent.upload(screen.getByLabelText('JSON-файл'), new File(['x'], 'metrics.json'));
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить JSON' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Невалидный JSON');
    expect(onLoaded).not.toHaveBeenCalled();
  });
});
