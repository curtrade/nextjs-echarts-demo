# JSON Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Загружать данные графика из JSON-файла через POST-форму «Загрузить JSON»; по умолчанию график пуст; добавить README на русском.

**Architecture:** `JsonUploadForm` шлёт файл в `POST /api/metrics` (валидация через `parseMetrics`), получает датасет и поднимает его в `MetricsDashboard`, который передаёт его пропом в презентационный `MetricsChart`. Авто-загрузка сэмпла убирается; `GET /api/metrics` остаётся для тестов.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Apache ECharts, zod, Vitest + React Testing Library.

**Спека:** `docs/superpowers/specs/2026-06-24-json-upload-design.md`

**Коммиты:** без строки `Co-Authored-By`. После каждой итерации — линт изменённых файлов (`npx eslint <files>`) и `npx prettier --write <files>`. Тесты запускать через `npx vitest run <path>` (полный прогон `npm test`).

---

## File Structure

| Файл | Ответственность |
|------|-----------------|
| `src/app/api/metrics/route.ts` | + `POST`: приём файла, валидация, возврат датасета / `400`. |
| `src/components/MetricsChart.tsx` | Презентационный: рисует по prop `dataset`; пусто → заглушка. |
| `src/components/JsonUploadForm.tsx` | `<form>` + `<input type=file>` + «Загрузить JSON»; POST; `onLoaded`. |
| `src/components/JsonUploadForm.module.css` | Стили формы. |
| `src/components/MetricsDashboard.tsx` | Владелец состояния `dataset`; форма + график. |
| `src/app/page.tsx` | Рендерит `<MetricsDashboard/>`. |
| `README.md` | Документация на русском. |

---

## Task 1: POST /api/metrics (TDD)

**Files:**
- Modify: `src/app/api/metrics/route.ts`
- Test: `src/app/api/metrics/route.test.ts` (добавить блок про POST)

- [ ] **Step 1: Дописать падающие тесты POST**

В конец `src/app/api/metrics/route.test.ts`, ПЕРЕД последней `});` файла не нужно лезть — добавить новый импорт `POST` и отдельный `describe` в конце файла. Сначала обновить строку импорта:

Заменить:
```ts
import { GET } from './route';
```
на:
```ts
import { GET, POST } from './route';
```

Затем добавить в конец файла:
```ts
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
```

(Константа `dataset` уже объявлена в этом файле для GET-тестов — переиспользуем.)

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/app/api/metrics/route.test.ts`
Expected: FAIL (`POST` не экспортируется из `./route`).

- [ ] **Step 3: Реализовать POST в `src/app/api/metrics/route.ts`**

Добавить в конец файла (после `GET`):
```ts
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return NextResponse.json({ error: 'Невалидный JSON' }, { status: 400 });
    }
    const dataset = parseMetrics(raw);
    return NextResponse.json(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/app/api/metrics/route.test.ts`
Expected: PASS (GET 3 + POST 4 = 7 тестов).

- [ ] **Step 5: Линт/формат и коммит**

```bash
npx eslint src/app/api/metrics/route.ts src/app/api/metrics/route.test.ts
npx prettier --write src/app/api/metrics/route.ts src/app/api/metrics/route.test.ts
git add -A && git commit -m "feat: accept JSON upload via POST /api/metrics"
```

---

## Task 2: Сделать MetricsChart презентационным (prop `dataset`) (TDD)

**Files:**
- Modify: `src/components/MetricsChart.tsx` (полная замена содержимого)
- Test: `src/components/MetricsChart.test.tsx` (полная замена содержимого)

- [ ] **Step 1: Заменить тест на новый (падающий)**

Полностью заменить содержимое `src/components/MetricsChart.test.tsx` на:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

beforeEach(() => vi.clearAllMocks());

describe('MetricsChart', () => {
  it('shows an upload prompt when dataset is null', () => {
    render(<MetricsChart dataset={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Загрузите JSON/);
    expect(vi.mocked(useECharts).mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('shows an upload prompt when points are empty', () => {
    render(<MetricsChart dataset={{ currency: 'USD', points: [] }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Загрузите JSON/);
    expect(vi.mocked(useECharts).mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('passes a 4-series option to useECharts when data is present', () => {
    render(<MetricsChart dataset={dataset} />);
    const lastCall = vi.mocked(useECharts).mock.calls.at(-1)?.[0];
    expect(lastCall).not.toBeNull();
    expect((lastCall?.series as unknown[]).length).toBe(4);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/components/MetricsChart.test.tsx`
Expected: FAIL (компонент пока требует данных через fetch, нет prop `dataset`, текста «Загрузите JSON» нет).

- [ ] **Step 3: Заменить компонент**

Полностью заменить содержимое `src/components/MetricsChart.tsx` на:
```tsx
'use client';

import { useMemo } from 'react';
import type { MetricsDataset } from '@/lib/metrics/types';
import { buildChartOption } from '@/lib/chart/buildOption';
import { useECharts } from '@/hooks/useECharts';
import styles from './MetricsChart.module.css';

// Колонка «якорей шкал» слева, как на референсе (декоративные минимумы осей).
const AXIS_PILLS = ['Tdy', '0%', '$0', '$0', '0', '0', '—'];

function EditButton() {
  return (
    <button type="button" className={styles.editBtn} aria-label="Редактировать">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      <span aria-hidden style={{ fontSize: 10 }}>
        ▾
      </span>
    </button>
  );
}

export function MetricsChart({ dataset }: { dataset: MetricsDataset | null }) {
  const option = useMemo(
    () => (dataset && dataset.points.length > 0 ? buildChartOption(dataset) : null),
    [dataset],
  );
  const containerRef = useECharts(option);

  const isEmpty = !dataset || dataset.points.length === 0;

  return (
    <div className={styles.panel}>
      <EditButton />
      <div className={styles.body}>
        <div className={styles.axisCol} aria-hidden>
          {AXIS_PILLS.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className={[
                styles.pill,
                i === 0 ? styles.pillToday : '',
                label === '—' ? styles.pillDash : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </span>
          ))}
        </div>
        <div className={styles.plot}>
          <div ref={containerRef} className={styles.chart} />
          {isEmpty && (
            <div role="status" className={styles.overlay}>
              Загрузите JSON, чтобы построить график
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/components/MetricsChart.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Линт/формат и коммит**

```bash
npx eslint src/components/MetricsChart.tsx src/components/MetricsChart.test.tsx
npx prettier --write src/components/MetricsChart.tsx src/components/MetricsChart.test.tsx
git add -A && git commit -m "refactor: make MetricsChart presentational (dataset prop, empty by default)"
```

---

## Task 3: JsonUploadForm (TDD)

**Files:**
- Create: `src/components/JsonUploadForm.tsx`
- Create: `src/components/JsonUploadForm.module.css`
- Test: `src/components/JsonUploadForm.test.tsx`

- [ ] **Step 1: Написать падающий тест**

Создать `src/components/JsonUploadForm.test.tsx`:
```tsx
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
    await userEvent.upload(
      screen.getByLabelText('JSON-файл'),
      new File(['x'], 'metrics.json'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить JSON' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Невалидный JSON');
    expect(onLoaded).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/components/JsonUploadForm.test.tsx`
Expected: FAIL (модуль `./JsonUploadForm` не найден).

- [ ] **Step 3: Создать `src/components/JsonUploadForm.module.css`**

```css
.form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 auto 14px;
  max-width: 640px;
  flex-wrap: wrap;
}

.input {
  font-size: 14px;
  color: #4a3f3f;
}

.button {
  background: #ffffff;
  border: 1px solid #e6c9c9;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 14px;
  color: #5b4646;
  cursor: pointer;
}

.button:hover:not(:disabled) {
  background: #fff5f5;
}

.button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  color: #c0392b;
  font-size: 13px;
}
```

- [ ] **Step 4: Создать `src/components/JsonUploadForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { MetricsDataset } from '@/lib/metrics/types';
import styles from './JsonUploadForm.module.css';

type Status = 'idle' | 'loading' | 'error';

export function JsonUploadForm({ onLoaded }: { onLoaded: (dataset: MetricsDataset) => void }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setStatus('error');
      setError('Выберите JSON-файл');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/metrics', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : `Ошибка ${res.status}`);
      }
      onLoaded(json as MetricsDataset);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Не удалось загрузить');
    }
  }

  return (
    <form onSubmit={handleSubmit} method="post" className={styles.form}>
      <input
        type="file"
        name="file"
        aria-label="JSON-файл"
        accept="application/json,.json"
        className={styles.input}
      />
      <button type="submit" disabled={status === 'loading'} className={styles.button}>
        {status === 'loading' ? 'Загрузка…' : 'Загрузить JSON'}
      </button>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npx vitest run src/components/JsonUploadForm.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 6: Линт/формат и коммит**

```bash
npx eslint src/components/JsonUploadForm.tsx src/components/JsonUploadForm.test.tsx
npx prettier --write src/components/JsonUploadForm.tsx src/components/JsonUploadForm.test.tsx src/components/JsonUploadForm.module.css
git add -A && git commit -m "feat: add JsonUploadForm (file input + POST)"
```

---

## Task 4: MetricsDashboard + страница

**Files:**
- Create: `src/components/MetricsDashboard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Создать `src/components/MetricsDashboard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { MetricsDataset } from '@/lib/metrics/types';
import { JsonUploadForm } from './JsonUploadForm';
import { MetricsChart } from './MetricsChart';

export function MetricsDashboard() {
  const [dataset, setDataset] = useState<MetricsDataset | null>(null);

  return (
    <div>
      <JsonUploadForm onLoaded={setDataset} />
      <MetricsChart dataset={dataset} />
    </div>
  );
}
```

- [ ] **Step 2: Обновить `src/app/page.tsx`**

Полностью заменить содержимое на:
```tsx
import { MetricsDashboard } from '@/components/MetricsDashboard';

export default function Home() {
  return (
    <main style={{ width: '100%', maxWidth: 680, margin: '40px auto', padding: '0 16px' }}>
      <MetricsDashboard />
    </main>
  );
}
```

- [ ] **Step 3: Проверить типы и весь набор тестов**

Run: `npx tsc --noEmit`
Expected: без ошибок.

Run: `npm test`
Expected: PASS — все наборы (parse, route GET+POST, buildOption, MetricsChart, JsonUploadForm).

- [ ] **Step 4: Линт/формат и коммит**

```bash
npx eslint src/components/MetricsDashboard.tsx src/app/page.tsx
npx prettier --write src/components/MetricsDashboard.tsx src/app/page.tsx
git add -A && git commit -m "feat: wire upload form and chart in MetricsDashboard"
```

---

## Task 5: README на русском

**Files:**
- Create: `README.md` (перезаписать дефолтный от create-next-app)

- [ ] **Step 1: Записать `README.md`**

```markdown
# График метрик (Cost / CPA / ROI / Conversions)

Интерактивный график маркетинговых метрик на **Next.js 16 + React 19 + Apache ECharts**.
Данные загружаются из JSON-файла через форму. По умолчанию график пуст.

## Стек

- Next.js 16 (App Router), React 19, TypeScript
- Apache ECharts — отрисовка графика
- zod — валидация загружаемых данных
- Vitest + React Testing Library — тесты

## Установка

```bash
npm install
```

## Запуск

### Дев-режим

```bash
npm run dev
```

Открой <http://localhost:3000>.

> ⚠️ Проект лежит на медленном диске, поэтому **первая компиляция страницы может занять
> 1–3 минуты** — это нормально, дальше работает быстро (горячая перезагрузка).

### Прод-режим (быстрый старт)

```bash
npm run build
npm start
```

Сборка компилирует всё один раз, дальше страница отдаётся мгновенно. Рекомендуется,
если важна скорость загрузки.

## Как инициализировать график

1. Открой <http://localhost:3000> — график пуст, показывает подсказку
   «Загрузите JSON, чтобы построить график».
2. Нажми на поле выбора файла, выбери `.json` нужного формата (см. ниже).
3. Нажми **«Загрузить JSON»** — данные провалидируются на сервере и график построится.

Данные хранятся только в состоянии страницы и сбрасываются при перезагрузке.

## Формат JSON

```json
{
  "currency": "USD",
  "points": [
    { "date": "2026-06-12", "cost": 44.36, "cpa": 1.23, "roi": 161.47, "conversions": 36 },
    { "date": "2026-06-13", "cost": 52.0, "cpa": 0.8, "roi": 92.0, "conversions": 45 }
  ]
}
```

- `date` — дата в формате `YYYY-MM-DD`;
- `cost` — затраты (валюта);
- `cpa` — цена за действие (валюта);
- `roi` — рентабельность (проценты);
- `conversions` — число конверсий (целое);
- `currency` — код валюты (по умолчанию `USD`).

Готовый пример лежит в `data/metrics.json`.

## API

- `GET /api/metrics` — отдаёт сэмпл из `data/metrics.json` (для проверки/демо).
- `POST /api/metrics` — приём загрузки: `multipart/form-data` с полем `file` (JSON-файл).
  Возвращает разобранный датасет (`200`) или `{ "error": "..." }` (`400`).

## Тесты и линт

```bash
npm test          # прогон всех тестов (Vitest)
npm run lint      # ESLint
npm run format    # Prettier --write
```

## Примечание про скорость

Проект находится на диске `/dev/sdb2`, который медленный на запись, из-за чего
дев-компиляция Turbopack долгая. Если нужна быстрая разработка — перенеси проект на
системный диск (раздел `/`). Перенос кэша `.next` отдельным симлинком не работает
(ломает резолв модулей Turbopack).
```

- [ ] **Step 2: Формат и коммит**

```bash
npx prettier --write README.md
git add -A && git commit -m "docs: add Russian README with setup and chart initialization"
```

---

## Task 6: Итоговая проверка

**Files:** —

- [ ] **Step 1: Полный прогон тестов**

Run: `npm test`
Expected: PASS — все файлы (`parse`, `route` GET+POST, `buildOption`, `MetricsChart`, `JsonUploadForm`).

- [ ] **Step 2: Полный линт и сборка**

Run: `npm run lint`
Expected: без ошибок.

Run: `npm run build`
Expected: успешная сборка; маршруты `/` (static) и `/api/metrics` (dynamic).

- [ ] **Step 3: Ручная проверка (прод-сервер)**

```bash
npm start -- -p 3000
```
- Открыть <http://localhost:3000> — график пуст, подсказка «Загрузите JSON…».
- Выбрать `data/metrics.json`, нажать «Загрузить JSON» — график строится (4 серии).
- Загрузить заведомо битый JSON — под формой появляется сообщение об ошибке, график не падает.

Остановить сервер.

- [ ] **Step 4: Коммит (если остались изменения форматирования)**

```bash
git add -A && git commit -m "chore: final verification for JSON upload" || echo "нечего коммитить"
```

---

## Self-Review (выполнено автором плана)

- **Покрытие спеки:** POST-роут → Task 1; презентационный `MetricsChart` + дефолт-пусто → Task 2;
  форма загрузки файлом + «Загрузить JSON» + состояния → Task 3; владелец состояния/связка +
  страница → Task 4; README на русском (установка, запуск, инициализация, формат, API) → Task 5;
  итоговая проверка (тесты/линт/сборка/ручная) → Task 6. YAGNI-пункты (textarea, «загрузить
  пример», серверное хранение) сознательно вне плана.
- **Плейсхолдеры:** нет — весь код приведён целиком.
- **Согласованность типов:** `MetricsDataset` из `@/lib/metrics/types` используется в `POST`,
  `MetricsChart({ dataset })`, `JsonUploadForm({ onLoaded })`, `MetricsDashboard`; поле формы —
  `file` (и в роуте `form.get('file')`, и в форме `body.append('file', file)`, и в тестах);
  текст кнопки «Загрузить JSON» и подсказки «Загрузите JSON, чтобы построить график» совпадают
  в компонентах и тестах.
```
