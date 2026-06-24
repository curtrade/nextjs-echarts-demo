# Дизайн: компонент графика метрик на ECharts

**Дата:** 2026-06-24
**Статус:** одобрено к планированию

## Цель

Построить интерактивный график маркетинговых метрик (Cost / CPA / ROI / Conversions
по датам), визуально повторяющий референс-скриншот: мульти-ось ($ / % / шт.),
area-заливка + сглаженные линии, квадратные маркеры и кастомный тултип при наведении.

Источник данных — файл (CSV/JSON), доставляемый клиенту через Next.js Route Handler.
Формат данных задаём мы; в репозитории лежит реалистичный сэмпл, который пользователь
позже подменит своим экспортом.

## Стек

- Next.js (App Router) + React + TypeScript (strict)
- Apache ECharts (Apache-2.0)
- zod — валидация/нормализация входных данных
- Vitest + React Testing Library — тесты (TDD)
- ESLint + Prettier — с самого старта

## Архитектура (поток данных A: Route Handler + клиентский fetch)

```
data/metrics.json                 ← сэмпл-датасет (~30 дней), подменяется пользователем
   │
src/lib/metrics/types.ts          ← MetricPoint, MetricsDataset
src/lib/metrics/parse.ts          ← parseMetrics(raw): чистый парсер+валидатор (zod)
   │
src/app/api/metrics/route.ts      ← Route Handler: fs.read → parseMetrics → NextResponse.json
   │  (fetch)
src/lib/chart/buildOption.ts      ← buildChartOption(dataset): чистая ф-ция → EChartsOption
src/components/MetricsChart.tsx   ← 'use client': fetch + loading/error/empty + рендер ECharts
src/hooks/useECharts.ts           ← тонкий хук: init/setOption/resize/dispose
src/app/page.tsx                  ← страница с <MetricsChart />
```

Ключевая идея: вся логика сосредоточена в **двух чистых изолированных единицах**
(`parseMetrics` и `buildChartOption`), которые тестируются по TDD без DOM.
React-компонент остаётся тонким — только состояния и связывание.

### Единицы и их границы

- **`parseMetrics(raw: unknown): MetricsDataset`** — что делает: валидирует и нормализует
  сырые данные файла, бросает типизированную ошибку на невалидном входе. Зависит только
  от zod-схемы. Тестируется изолированно.
- **`buildChartOption(dataset: MetricsDataset): EChartsOption`** — что делает: маппит
  датасет в конфиг ECharts (оси, серии, цвета, тултип). Чистая, детерминированная.
  Зависит от типов ECharts. Тестируется изолированно.
- **`GET /api/metrics`** — что делает: читает файл, прогоняет через `parseMetrics`,
  отдаёт JSON или `500 { error }`. Зависит от `fs` и `parseMetrics`.
- **`useECharts`** — что делает: инкапсулирует жизненный цикл инстанса ECharts
  (init в `useEffect`, `setOption`, resize-обсервер, `dispose`). Зависит от `echarts`.
- **`MetricsChart`** — что делает: фетчит `/api/metrics`, управляет состояниями
  loading/error/empty/data, прокидывает `buildChartOption(data)` в `useECharts`.

## Контракт данных

```jsonc
{
  "currency": "USD",
  "points": [
    { "date": "2026-06-12", "cost": 44.36, "cpa": 12.1, "roi": 161.47, "conversions": 36 },
    // …примерно 30 ежедневных точек
  ],
}
```

- `date` — ISO `YYYY-MM-DD` (строка). В осях/тултипе отображается как `DD.MM.YYYY`.
- `cost` — валюта `$` (number).
- `cpa` — валюта `$` (number).
- `roi` — проценты `%` (number).
- `conversions` — целое, шт. (number).
- `currency` — код валюты (для форматирования), по умолчанию `USD`.

Невалидность (отсутствует поле, неверный тип, пустой `points` не является ошибкой —
обрабатывается как empty-состояние) → `parseMetrics` бросает ошибку с понятным сообщением.

## Конфиг ECharts

- **xAxis**: `type: 'category'`, значения — даты, форматирование `DD.MM.YYYY`.
- **yAxis (несколько)**:
  - ось 0 — валюта (`$`) для серий Cost и CPA;
  - ось 1 — проценты (`%`) для ROI;
  - ось 2 — count (шт.) для Conversions.
  - Лишние оси визуально скрыты (без линий/меток), сетка рисуется от одной оси.
- **Серии**:
  - `Cost` — `type: 'line'`, `areaStyle` (бежевая/хаки заливка), валютная ось.
  - `CPA` — `type: 'line'`, синяя, валютная ось.
  - `ROI` — `type: 'line'`, `smooth: true`, зелёная, ось процентов.
  - `Conversions` — `type: 'line'`, маджента, `symbol: 'rect'` (квадратные маркеры), ось count.
- **tooltip**: `trigger: 'axis'` + кастомный HTML-форматтер: дата заголовком, затем
  по каждой метрике — цветная точка, подпись и значение (`Cost: 44.36`, `ROI: 161.47`, …),
  с форматированием по типу ($ / % / целое).
- **Палитра** под референс: хаки `#d8d09a`, синий `#4a7fd4`, зелёный `#2e8b3d`,
  маджента `#c026d3`.
- **Рендер**: хук `useECharts` (init в `useEffect`, resize-обсервер, dispose),
  без сторонних обёрток вроде `echarts-for-react`.

## Обработка ошибок и краевых случаев

- Парсер: отсутствует поле / неверный тип → типизированная ошибка → route отдаёт `500 { error }`.
- Пустой `points` → валидный датасет → компонент показывает empty-заглушку.
- Клиент: состояния **loading** (скелет), **error** (сообщение + кнопка retry),
  **empty** (заглушка), **data** (график).
- Форматирование: валюта с `$`, проценты с `%`, conversions как целое; даты `DD.MM.YYYY`.

## Тестирование (TDD)

Сначала тест, затем реализация, затем рефактор. После каждой итерации — линт + фикс.

- **`parseMetrics`**: валидный вход; пропущенное поле; неверный тип; пустой `points`
  (валиден → пустой датасет); нормализация даты.
- **`buildChartOption`**: корректное число серий (4); привязка серий к нужным осям;
  цвета по палитре; `symbol: 'rect'` у Conversions; `areaStyle` у Cost; `smooth` у ROI;
  результат форматтера тултипа.
- **`GET /api/metrics`**: возвращает распарсенный JSON; корректно ловит ошибку
  чтения/парсинга и отдаёт 500.
- **`MetricsChart`**: loading → data (мок fetch); error-состояние; empty-состояние.
  Инстанс ECharts мокается (canvas недоступен в jsdom) — проверяем, что в `setOption`
  уходит результат `buildChartOption`.

## Вне начального scope (YAGNI)

- Кнопка-карандаш «edit» из правого верхнего угла референса.
- Маркер «Tdy / Today» (вертикальная отметка текущего дня).
- Фильтры по диапазону дат, легенда-переключатель серий.

Добавляется отдельными итерациями при необходимости.

## Структура проекта (итог)

```
data/metrics.json
src/
  app/
    api/metrics/route.ts
    page.tsx
    layout.tsx
  components/MetricsChart.tsx
  hooks/useECharts.ts
  lib/
    metrics/{types.ts,parse.ts}
    chart/buildOption.ts
tests/ (или *.test.ts рядом с модулями)
```
