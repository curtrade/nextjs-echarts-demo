// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

import { readFile } from 'node:fs/promises';
import { GET, POST } from './route';

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

function uploadRequest(file: File): Request {
  const body = new FormData();
  body.append('file', file);
  return new Request('http://localhost/api/metrics', { method: 'POST', body });
}

describe('POST /api/metrics', () => {
  it('returns the parsed dataset for a valid file', async () => {
    const file = new File([JSON.stringify(dataset)], 'metrics.json', {
      type: 'application/json',
    });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(dataset);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await POST(
      new Request('http://localhost/api/metrics', { method: 'POST', body: new FormData() }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(uploadRequest(new File(['not json'], 'metrics.json')));
    expect(res.status).toBe(400);
  });

  it('returns 400 when data does not match the schema', async () => {
    const bad = JSON.stringify({ currency: 'USD', points: [{ date: 'bad' }] });
    const res = await POST(uploadRequest(new File([bad], 'metrics.json')));
    expect(res.status).toBe(400);
  });
});
