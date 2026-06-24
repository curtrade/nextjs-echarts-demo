import type { EChartsOption } from 'echarts';
import type { MetricsDataset } from '@/lib/metrics/types';

// Цвета сняты пипеткой с референса (CleanShot GIF).
export const SERIES_COLORS = {
  cost: '#e9c84a',
  cpa: '#346efd',
  roi: '#0f9b00',
  conversions: '#b500fe',
} as const;

/** Пастельная заливка области Cost. */
export const COST_AREA_FILL = '#fff0bf';

/** Отображаемое имя серии ROI на референсе. */
export const ROI_SERIES_NAME = 'ROI confirmed';

/** Цвет «точки» в тултипе по имени серии. */
const DOT_COLORS: Record<string, string> = {
  Cost: '#ecdf86',
  CPA: SERIES_COLORS.cpa,
  [ROI_SERIES_NAME]: SERIES_COLORS.roi,
  Conversions: SERIES_COLORS.conversions,
};

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
    case ROI_SERIES_NAME:
      return `${value.toFixed(2)}%`;
    default:
      return String(value);
  }
}

function dot(color: string): string {
  return `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${color};margin-right:9px;flex:0 0 auto"></span>`;
}

export function formatTooltip(params: TooltipParam[], currencySymbol: string): string {
  const date = params[0]?.axisValueLabel ?? params[0]?.axisValue ?? '';
  const rows = params
    .map((p) => {
      const name = p.seriesName ?? '';
      const color = DOT_COLORS[name] ?? '#999';
      const value = formatValue(name, p.value, currencySymbol);
      return (
        `<div style="display:flex;align-items:center;margin-top:7px;font-size:15px;line-height:1.1;color:#2b2b2b">` +
        `${dot(color)}<span style="color:#5b5b5b">${name}:</span>&nbsp;<b style="color:#111;font-weight:700">${value}</b></div>`
      );
    })
    .join('');
  return (
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif">` +
    `<div style="font-size:13px;color:#9a9a9a">${date}</div>${rows}</div>`
  );
}

export function buildChartOption(dataset: MetricsDataset): EChartsOption {
  const { currency, points } = dataset;
  const currencySymbol = currency === 'USD' ? '$' : currency;
  const dates = points.map((p) => formatDate(p.date));

  const halo = (rgba: string) => ({
    focus: 'self' as const,
    scale: 1.7,
    itemStyle: { shadowBlur: 18, shadowColor: rgba, opacity: 1 },
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: '#ffffff',
      borderWidth: 0,
      padding: [12, 16, 13, 14],
      extraCssText: 'border-radius:14px;box-shadow:0 12px 32px rgba(70,30,30,0.16);',
      // Лёгкая вертикальная направляющая; основной акцент — «ореол» на точках.
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(40,20,20,0.08)', width: 1 } },
      formatter: (params) => formatTooltip(params as unknown as TooltipParam[], currencySymbol),
    },
    grid: { left: 10, right: 12, top: 16, bottom: 10, containLabel: false },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(80,40,40,0.18)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(120,70,70,0.06)' } },
    },
    yAxis: [
      // 0 — валюта ($): Cost (area) + CPA (низко у дна)
      { type: 'value', show: false, min: 0 },
      // 1 — проценты (%): ROI confirmed, своя шкала
      { type: 'value', show: false, scale: true },
      // 2 — count (шт.): Conversions, своя шкала
      { type: 'value', show: false, scale: true },
    ],
    series: [
      {
        name: 'Cost',
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        z: 1,
        lineStyle: { color: SERIES_COLORS.cost, width: 2 },
        areaStyle: { color: COST_AREA_FILL, opacity: 1 },
        itemStyle: { color: SERIES_COLORS.cost },
        symbol: 'circle',
        symbolSize: 7,
        emphasis: halo('rgba(233,200,74,0.4)'),
        data: points.map((p) => p.cost),
      },
      {
        name: 'CPA',
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        z: 2,
        // Толстая синяя линия с круглыми торцами и пунктиром — «пилюли» у дна, как на референсе.
        lineStyle: { color: SERIES_COLORS.cpa, width: 5, cap: 'round', type: [7, 12] },
        itemStyle: { color: SERIES_COLORS.cpa },
        symbol: 'circle',
        symbolSize: 7,
        emphasis: halo('rgba(52,110,253,0.4)'),
        data: points.map((p) => p.cpa),
      },
      {
        name: ROI_SERIES_NAME,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        z: 4,
        lineStyle: { color: SERIES_COLORS.roi, width: 4 },
        itemStyle: { color: SERIES_COLORS.roi },
        symbol: 'circle',
        symbolSize: 8,
        emphasis: halo('rgba(15,155,0,0.38)'),
        data: points.map((p) => p.roi),
      },
      {
        name: 'Conversions',
        type: 'line',
        yAxisIndex: 2,
        smooth: false,
        z: 3,
        showSymbol: true,
        symbol: 'rect',
        symbolSize: 9,
        lineStyle: { color: SERIES_COLORS.conversions, width: 2 },
        itemStyle: { color: SERIES_COLORS.conversions },
        emphasis: halo('rgba(181,0,254,0.38)'),
        data: points.map((p) => p.conversions),
      },
    ],
  };
}
