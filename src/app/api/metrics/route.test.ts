// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

import { readFile } from 'node:fs/promises';
import { GET } from './route';

const dataset = {
  currency: 'USD',
  points: [{ date: '2026-06-12', cost: 44.36, cpa: 12.1, roi: 161.47, conversions: 36 }],
};

describe('GET /api/metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the parsed dataset as JSON', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(dataset));
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(dataset);
  });

  it('returns 500 when the file cannot be read', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'ENOENT' });
  });

  it('returns 500 when the data is invalid', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ currency: 'USD', points: [{ date: 'bad' }] }),
    );
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
