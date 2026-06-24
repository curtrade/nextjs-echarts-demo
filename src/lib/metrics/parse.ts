import { z } from 'zod';
import type { MetricsDataset } from './types';

const metricPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  cost: z.number(),
  cpa: z.number(),
  roi: z.number(),
  conversions: z.number(),
});

const datasetSchema = z.object({
  currency: z.string().default('USD'),
  points: z.array(metricPointSchema),
});

export function parseMetrics(raw: unknown): MetricsDataset {
  const result = datasetSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'unknown error';
    throw new Error(`Invalid metrics data: ${message}`);
  }
  return result.data;
}
