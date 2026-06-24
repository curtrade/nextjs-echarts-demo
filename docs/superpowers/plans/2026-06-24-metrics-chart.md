# Metrics Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить интерактивный график маркетинговых метрик (Cost / CPA / ROI / Conversions по датам) на Apache ECharts, повторяющий референс-скриншот, с данными из файла через Next.js Route Handler.

**Architecture:** Поток A — файл `data/metrics.json` → чистый парсер (`parseMetrics`) → Route Handler `GET /api/metrics` → клиентский `<MetricsChart />` фетчит JSON и рендерит ECharts. Вся логика в двух чистых единицах (`parseMetrics`, `buildChartOption`), которые тестируются по TDD без DOM; React-компонент тонкий.

**Tech Stack:** Next.js (App Router) + React + TypeScript (strict), Apache ECharts, zod, Vitest + React Testing Library, ESLint + Prettier.

**Спека:** `docs/superpowers/specs/2026-06-24-metrics-chart-design.md`

**Замечание про коммиты:** в сообщениях коммитов НЕ добавлять строку `Co-Authored-By` (правило пользователя). После каждой TDD-итерации запускать `npm run lint` и `npm run format` и фиксить ошибки.

---

## File Structure

| Файл                                  | Ответственность                                                       |
| ------------------------------------- | --------------------------------------------------------------------- |
| `data/metrics.json`                   | Сэмпл-датасет (~15 ежедневных точек). Пользователь подменит своим.    |
| `src/lib/metrics/types.ts`            | Типы `MetricPoint`, `MetricsDataset`.                                 |
| `src/lib/metrics/parse.ts`            | `parseMetrics(raw): MetricsDataset` — валидация/нормализация (zod).   |
| `src/app/api/metrics/route.ts`        | Route Handler `GET`: читает файл → `parseMetrics` → JSON / `500`.     |
| `src/lib/chart/buildOption.ts`        | `buildChartOption(dataset): EChartsOption` + `formatTooltip`. Чистые. |
| `src/hooks/useECharts.ts`             | Хук: init/setOption/resize/dispose инстанса ECharts.                  |
| `src/components/MetricsChart.tsx`     | `'use client'`: fetch + loading/error/empty/data + рендер.            |
| `src/app/page.tsx`                    | Страница с `<MetricsChart />`.                                        |
| `vitest.config.ts`, `vitest.setup.ts` | Конфиг тестов.                                                        |

---

## Task 1: Scaffold проекта и тулинга

**Files:**

- Create: весь каркас Next.js, `vitest.config.ts`, `vitest.setup.ts`, `.prettierrc.json`
- Modify: `package.json` (scripts), ESLint-конфиг

- [ ] **Step 1: Инициализировать git и временно убрать docs**

create-next-app отказывается работать в непустой папке. `docs/` уже существует — уберём её на время.

```bash
cd /mnt/data/home/curtrade/nodejs/vibecoding/chart
git init
mv docs /tmp/chart-docs-backup
```

- [ ] **Step 2: Сгенерировать Next.js-приложение**

```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm
```

Если останутся интерактивные вопросы (например про Turbopack) — принять значения по умолчанию (Enter).
Ожидается: создан каркас с `src/app/`, `tsconfig.json` (alias `@/*` → `./src/*`), `package.json`.

- [ ] **Step 3: Вернуть docs на место**

```bash
mv /tmp/chart-docs-backup docs
```

- [ ] **Step 4: Установить зависимости**

```bash
npm install echarts zod
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event prettier eslint-config-prettier
```

- [ ] **Step 5: Создать `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 6: Создать `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Создать `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 8: Добавить скрипты в `package.json`**

В секцию `"scripts"` добавить (не удаляя `dev`/`build`/`start`/`lint`):

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

- [ ] **Step 9: Подключить eslint-config-prettier**

Чтобы ESLint не конфликтовал с Prettier, добавить `eslint-config-prettier` последним в конфиг ESLint:

- Если flat-config (`eslint.config.mjs`): импортировать `import prettier from 'eslint-config-prettier';` и добавить `prettier` последним элементом экспортируемого массива.
- Если `.eslintrc.json`: добавить `"prettier"` последним в массив `extends`.

- [ ] **Step 10: Smoke-тест — убедиться, что Vitest работает**

Создать `src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: PASS (1 passed).

- [ ] **Step 11: Удалить smoke-тест**

```bash
rm src/smoke.test.ts
```

- [ ] **Step 12: Линт/формат и коммит**

```bash
npm run lint
npm run format
git add -A
git commit -m "chore: scaffold next.js app with vitest, prettier and eslint"
```

---

## Task 2: Типы и сэмпл-датасет

**Files:**

- Create: `src/lib/metrics/types.ts`
- Create: `data/metrics.json`

- [ ] **Step 1: Создать `src/lib/metrics/types.ts`**

```ts
export interface MetricPoint {
  /** ISO date, формат YYYY-MM-DD */
  date: string;
  /** Затраты, валюта */
  cost: number;
  /** Cost per action, валюта */
  cpa: number;
  /** Return on investment, проценты */
  roi: number;
  /** Конверсии, целое (шт.) */
  conversions: number;
}

export interface MetricsDataset {
  /** Код валюты для форматирования, напр. "USD" */
  currency: string;
  points: MetricPoint[];
}
```

- [ ] **Step 2: Создать `data/metrics.json`**

```json
{
  "currency": "USD",
  "points": [
    { "date": "2026-06-01", "cost": 31.2, "cpa": 10.4, "roi": 120.5, "conversions": 30 },
    { "date": "2026-06-02", "cost": 28.75, "cpa": 11.1, "roi": 118.2, "conversions": 26 },
    { "date": "2026-06-03", "cost": 33.4, "cpa": 9.8, "roi": 132.1, "conversions": 34 },
    { "date": "2026-06-04", "cost": 35.1, "cpa": 10.2, "roi": 140.0, "conversions": 34 },
    { "date": "2026-06-05", "cost": 30.9, "cpa": 12.3, "roi": 125.6, "conversions": 25 },
    { "date": "2026-06-06", "cost": 38.6, "cpa": 11.5, "roi": 150.3, "conversions": 33 },
    { "date": "2026-06-07", "cost": 41.2, "cpa": 10.9, "roi": 155.8, "conversions": 38 },
    { "date": "2026-06-08", "cost": 37.45, "cpa": 12.8, "roi": 145.2, "conversions": 29 },
    { "date": "2026-06-09", "cost": 42.1, "cpa": 11.2, "roi": 158.4, "conversions": 37 },
    { "date": "2026-06-10", "cost": 39.8, "cpa": 13.1, "roi": 150.9, "conversions": 30 },
    { "date": "2026-06-11", "cost": 43.55, "cpa": 11.7, "roi": 159.3, "conversions": 37 },
    { "date": "2026-06-12", "cost": 44.36, "cpa": 12.1, "roi": 161.47, "conversions": 36 },
    { "date": "2026-06-13", "cost": 47.2, "cpa": 11.3, "roi": 168.1, "conversions": 41 },
    { "date": "2026-06-14", "cost": 45.9, "cpa": 12.6, "roi": 162.7, "conversions": 36 },
    { "date": "2026-06-15", "cost": 49.3, "cpa": 10.8, "roi": 175.4, "conversions": 45 }
  ]
}
```

- [ ] **Step 3: Линт/формат и коммит**

```bash
npm run format
git add -A
git commit -m "feat: add metrics domain types and sample dataset"
```

---

## Task 3: parseMetrics (TDD)

**Files:**

- Test: `src/lib/metrics/parse.test.ts`
- Create: `src/lib/metrics/parse.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/metrics/parse.test.ts`:

```ts
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- parse`
Expected: FAIL (`parseMetrics` не определён / модуль не найден).

- [ ] **Step 3: Реализовать `src/lib/metrics/parse.ts`**

```ts
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
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- parse`
Expected: PASS (6 passed).

- [ ] **Step 5: Линт/формат и коммит**

```bash
npm run lint && npm run format
git add -A
git commit -m "feat: add parseMetrics validator"
```

---

## Task 4: Route Handler GET /api/metrics (TDD)

**Files:**

- Test: `src/app/api/metrics/route.test.ts`
- Create: `src/app/api/metrics/route.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `src/app/api/metrics/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- route`
Expected: FAIL (`GET` не определён / модуль не найден).

- [ ] **Step 3: Реализовать `src/app/api/metrics/route.ts`**

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { parseMetrics } from '@/lib/metrics/parse';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'metrics.json');
    const raw = JSON.parse(await readFile(filePath, 'utf-8'));
    const dataset = parseMetrics(raw);
    return NextResponse.json(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- route`
Expected: PASS (3 passed).

- [ ] **Step 5: Линт/формат и коммит**

```bash
npm run lint && npm run format
git add -A
git commit -m "feat: add /api/metrics route handler"
```

---

## Task 5: buildChartOption + formatTooltip (TDD)

**Files:**

- Test: `src/lib/chart/buildOption.test.ts`
- Create: `src/lib/chart/buildOption.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `src/lib/chart/buildOption.test.ts`:

```ts
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
    expect(byName).toEqual({ Cost: 0, CPA: 0, ROI: 1, Conversions: 2 });
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
    expect(series(dataset).find((s) => s.name === 'ROI')?.smooth).toBe(true);
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
        { axisValueLabel: '12.06.2026', seriesName: 'ROI', value: 161.47, marker: '' },
        { axisValueLabel: '12.06.2026', seriesName: 'Conversions', value: 36, marker: '' },
      ],
      '$',
    );
    expect(html).toContain('12.06.2026');
    expect(html).toContain('$44.36');
    expect(html).toContain('161.47%');
    expect(html).toContain('36');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- buildOption`
Expected: FAIL (`buildChartOption` не определён).

- [ ] **Step 3: Реализовать `src/lib/chart/buildOption.ts`**

```ts
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
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- buildOption`
Expected: PASS (7 passed).

- [ ] **Step 5: Линт/формат и коммит**

```bash
npm run lint && npm run format
git add -A
git commit -m "feat: add buildChartOption and tooltip formatter"
```

---

## Task 6: Хук useECharts

**Files:**

- Create: `src/hooks/useECharts.ts`

> Это адаптер к DOM/canvas (ECharts требует реального canvas, недоступного в jsdom).
> Юнит-тестом не покрываем — это интеграционный шов; проверяется ручным запуском (Task 8)
> и косвенно в тестах `MetricsChart` (хук замокан). Логику в нём держим минимальной.

- [ ] **Step 1: Создать `src/hooks/useECharts.ts`**

```ts
'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

/**
 * Управляет жизненным циклом инстанса ECharts.
 * Возвращает ref на контейнер, который нужно навесить на <div>.
 */
export function useECharts(option: EChartsOption | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option);
    }
  }, [option]);

  return containerRef;
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Линт/формат и коммит**

```bash
npm run lint && npm run format
git add -A
git commit -m "feat: add useECharts hook"
```

---

## Task 7: Компонент MetricsChart (TDD)

**Files:**

- Test: `src/components/MetricsChart.test.tsx`
- Create: `src/components/MetricsChart.tsx`

- [ ] **Step 1: Написать падающий тест**

Создать `src/components/MetricsChart.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- MetricsChart`
Expected: FAIL (`MetricsChart` не определён).

- [ ] **Step 3: Реализовать `src/components/MetricsChart.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MetricsDataset } from '@/lib/metrics/types';
import { buildChartOption } from '@/lib/chart/buildOption';
import { useECharts } from '@/hooks/useECharts';

type Status = 'loading' | 'error' | 'ready';

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

export function MetricsChart() {
  const [dataset, setDataset] = useState<MetricsDataset | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(() => {
    setStatus('loading');
    fetch('/api/metrics')
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data: MetricsDataset) => {
        setDataset(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const option = useMemo(
    () => (dataset && dataset.points.length > 0 ? buildChartOption(dataset) : null),
    [dataset],
  );
  const containerRef = useECharts(option);

  const isEmpty = status === 'ready' && dataset?.points.length === 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {status === 'loading' && (
        <div role="status" style={overlayStyle}>
          Загрузка…
        </div>
      )}
      {status === 'error' && (
        <div role="alert" style={overlayStyle}>
          Не удалось загрузить данные.
          <button type="button" onClick={load}>
            Повторить
          </button>
        </div>
      )}
      {isEmpty && (
        <div role="status" style={overlayStyle}>
          Нет данных за выбранный период
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- MetricsChart`
Expected: PASS (4 passed).

- [ ] **Step 5: Линт/формат и коммит**

```bash
npm run lint && npm run format
git add -A
git commit -m "feat: add MetricsChart component with loading/error/empty states"
```

---

## Task 8: Страница и ручная проверка

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Заменить содержимое `src/app/page.tsx`**

```tsx
import { MetricsChart } from '@/components/MetricsChart';

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px' }}>
      <h1>Метрики кампании</h1>
      <MetricsChart />
    </main>
  );
}
```

- [ ] **Step 2: Прогнать весь набор тестов**

Run: `npm test`
Expected: PASS — все наборы (parse, route, buildOption, MetricsChart).

- [ ] **Step 3: Проверить сборку и типы**

Run: `npm run build`
Expected: успешная сборка без ошибок типов/линта.

- [ ] **Step 4: Ручная проверка в браузере**

```bash
npm run dev
```

Открыть http://localhost:3000. Ожидается:

- график с 4 сериями (бежевая area Cost, синяя CPA, зелёная сглаженная ROI, фиолетовая Conversions с квадратными маркерами);
- при наведении — тултип с датой `DD.MM.YYYY` и значениями (`$`, `%`, шт.);
- ресайз окна корректно перерисовывает график.

Остановить dev-сервер (Ctrl+C).

- [ ] **Step 5: Финальный линт/формат и коммит**

```bash
npm run lint && npm run format
git add -A
git commit -m "feat: render MetricsChart on home page"
```

---

## Self-Review (выполнено автором плана)

- **Покрытие спеки:** контракт данных → Task 2/3; Route Handler → Task 4; конфиг ECharts (оси, серии, area, smooth, rect, tooltip, палитра) → Task 5; рендер/хук → Task 6; loading/error/empty → Task 7; страница + ручная проверка → Task 8; тулинг (ESLint/Prettier/Vitest) → Task 1. YAGNI-пункты (edit-кнопка, Tdy-маркер) сознательно вне плана.
- **Плейсхолдеры:** отсутствуют — весь код приведён целиком.
- **Согласованность типов:** `MetricPoint`/`MetricsDataset` (Task 2) используются в `parseMetrics` (3), `route` (4), `buildChartOption` (5), `MetricsChart` (7); `buildChartOption`/`SERIES_COLORS`/`formatTooltip`/`TooltipParam` (5) согласованы с тестами; `useECharts(option)` (6) вызывается в `MetricsChart` (7) и мокается в его тесте.
