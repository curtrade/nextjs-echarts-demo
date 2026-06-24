import { describe, it, expect } from 'vitest';
import { buildChartOption, SERIES_COLORS, formatTooltip } from './buildOption';
import type { MetricsDataset } from '@/lib/metrics/types';

const dataset: MetricsDataset = {
  currency: 'USD',
  points: [
    { date: '2026-06-12', cost: 44.36, cpa: 12.1, roi: 161.47, conversions: 36 },
    { date: '2026-06-13', cost: 50.0, cpa: 10.0, roi: 170.0, conversions: 40 },
  ],
};

type Series = {
  name: string;
  yAxisIndex: number;
  symbol?: string;
  smooth?: boolean;
  areaStyle?: object;
  itemStyle?: { color?: string };
};

function series(d: MetricsDataset): Series[] {
  return buildChartOption(d).series as unknown as Series[];
}

describe('buildChartOption', () => {
  it('creates four series', () => {
    expect(series(dataset).length).toBe(4);
  });

  it('maps series to the correct y-axis', () => {
    const byName = Object.fromEntries(series(dataset).map((s) => [s.name, s.yAxisIndex]));
    expect(byName).toEqual({ Cost: 0, CPA: 0, 'ROI confirmed': 1, Conversions: 2 });
  });

  it('uses square markers for conversions', () => {
    expect(series(dataset).find((s) => s.name === 'Conversions')?.symbol).toBe('rect');
  });

  it('gives Cost an area style and palette color', () => {
    const cost = series(dataset).find((s) => s.name === 'Cost');
    expect(cost?.areaStyle).toBeDefined();
    expect(cost?.itemStyle?.color).toBe(SERIES_COLORS.cost);
  });

  it('smooths the ROI line', () => {
    expect(series(dataset).find((s) => s.name === 'ROI confirmed')?.smooth).toBe(true);
  });

  it('formats x-axis dates as DD.MM.YYYY', () => {
    const xAxis = buildChartOption(dataset).xAxis as { data: string[] };
    expect(xAxis.data[0]).toBe('12.06.2026');
  });
});

describe('formatTooltip', () => {
  it('formats currency, percent and count values', () => {
    const html = formatTooltip(
      [
        { axisValueLabel: '12.06.2026', seriesName: 'Cost', value: 44.36, marker: '' },
        { axisValueLabel: '12.06.2026', seriesName: 'ROI confirmed', value: 161.47, marker: '' },
        { axisValueLabel: '12.06.2026', seriesName: 'Conversions', value: 36, marker: '' },
      ],
      '$',
    );
    expect(html).toContain('12.06.2026');
    expect(html).toContain('$44.36');
    expect(html).toContain('161.47%');
    expect(html).toContain('36');
    expect(html).toContain('ROI confirmed');
  });
});
