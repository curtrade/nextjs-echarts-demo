import type { EChartsOption } from 'echarts';
import type { MetricsDataset } from '@/lib/metrics/types';

export const SERIES_COLORS = {
  cost: '#d8d09a',
  cpa: '#4a7fd4',
  roi: '#2e8b3d',
  conversions: '#c026d3',
} as const;

export interface TooltipParam {
  axisValueLabel?: string;
  axisValue?: string;
  seriesName?: string;
  value: number;
  marker?: string;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatValue(seriesName: string, value: number, currencySymbol: string): string {
  switch (seriesName) {
    case 'Cost':
    case 'CPA':
      return `${currencySymbol}${value.toFixed(2)}`;
    case 'ROI':
      return `${value.toFixed(2)}%`;
    default:
      return String(value);
  }
}

export function formatTooltip(params: TooltipParam[], currencySymbol: string): string {
  const date = params[0]?.axisValueLabel ?? params[0]?.axisValue ?? '';
  const rows = params
    .map((p) => {
      const v = formatValue(p.seriesName ?? '', p.value, currencySymbol);
      return `${p.marker ?? ''} ${p.seriesName}: <b>${v}</b>`;
    })
    .join('<br/>');
  return `<div style="margin-bottom:4px">${date}</div>${rows}`;
}

export function buildChartOption(dataset: MetricsDataset): EChartsOption {
  const { currency, points } = dataset;
  const currencySymbol = currency === 'USD' ? '$' : currency;
  const dates = points.map((p) => formatDate(p.date));

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => formatTooltip(params as unknown as TooltipParam[], currencySymbol),
    },
    grid: { left: 48, right: 48, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: [
      { type: 'value', name: currencySymbol, position: 'left' },
      { type: 'value', name: '%', position: 'right', show: false },
      { type: 'value', name: 'шт.', position: 'right', show: false },
    ],
    series: [
      {
        name: 'Cost',
        type: 'line',
        yAxisIndex: 0,
        data: points.map((p) => p.cost),
        areaStyle: { color: SERIES_COLORS.cost, opacity: 0.6 },
        lineStyle: { color: SERIES_COLORS.cost },
        itemStyle: { color: SERIES_COLORS.cost },
      },
      {
        name: 'CPA',
        type: 'line',
        yAxisIndex: 0,
        data: points.map((p) => p.cpa),
        lineStyle: { color: SERIES_COLORS.cpa },
        itemStyle: { color: SERIES_COLORS.cpa },
      },
      {
        name: 'ROI',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: points.map((p) => p.roi),
        lineStyle: { color: SERIES_COLORS.roi },
        itemStyle: { color: SERIES_COLORS.roi },
      },
      {
        name: 'Conversions',
        type: 'line',
        yAxisIndex: 2,
        symbol: 'rect',
        symbolSize: 8,
        data: points.map((p) => p.conversions),
        lineStyle: { color: SERIES_COLORS.conversions },
        itemStyle: { color: SERIES_COLORS.conversions },
      },
    ],
  };
}
