# Дизайн: загрузка JSON в график + README

**Дата:** 2026-06-24
**Статус:** одобрено к планированию

## Цель

Дать возможность загрузить данные графика из JSON-файла через POST-форму, а не из
вшитого сэмпла. По умолчанию график **пуст**; данные появляются после загрузки файла.
Плюс — написать подробный README на русском о том, как инициализировать график.

Поведение и стиль самого графика не меняются — меняется только источник данных
(с авто-загрузки сэмпла на загрузку файлом) и добавляется форма загрузки.

## Решения (из брейншторма)

- Загрузка **файлом**: `<input type="file" accept="application/json,.json">` внутри `<form>`,
  кнопка с текстом «Загрузить JSON».
- Механизм: **`POST /api/metrics`** (Route Handler) + клиентский `fetch`. Роут валидирует
  и возвращает датасет; клиент рисует. (Это буквально «роут», легко тестируется.)
- По умолчанию график пуст.
- `GET /api/metrics` и `data/metrics.json` **остаются** для тестов/ручной проверки, но UI
  больше не загружает их автоматически (YAGNI: без кнопки «загрузить пример»).

## Архитектура

Поток данных разворачивается «сверху вниз»: владелец состояния — дашборд, форма поднимает
загруженный датасет наверх, график — презентационный.

```
src/app/page.tsx                     → рендерит <MetricsDashboard/>
src/components/MetricsDashboard.tsx  → 'use client': владелец состояния dataset; форма + график
src/components/JsonUploadForm.tsx    → 'use client': <form> + <input type=file> + «Загрузить JSON»
src/components/MetricsChart.tsx      → 'use client': презентационный, рисует по prop `dataset`
src/hooks/useECharts.ts              → без изменений
src/lib/chart/buildOption.ts         → без изменений
src/lib/metrics/parse.ts             → переиспользуется в POST
src/app/api/metrics/route.ts         → + POST (приём файла, валидация, возврат датасета)
README.md                            → новый, на русском
```

### Границы компонентов

- **`JsonUploadForm({ onLoaded }: { onLoaded: (d: MetricsDataset) => void })`** — что делает:
  показывает `<form>` с `<input type="file">` и кнопкой «Загрузить JSON»; на сабмит читает
  выбранный файл, шлёт `multipart/form-data` (поле `file`) в `POST /api/metrics`, при успехе
  вызывает `onLoaded(dataset)`. Держит собственные состояния `idle | loading | error`.
  Единственный компонент, который знает про fetch/POST. Зависит от типов `MetricsDataset`.
- **`MetricsChart({ dataset }: { dataset: MetricsDataset | null })`** — что делает: чистая
  отрисовка. `null` или пустой `points` → заглушка-призыв; иначе `buildChartOption(dataset)`
  → `useECharts`. Больше не фетчит (удаляются `fetch`/`reloadKey`/`loading`/`error`).
  Зависит от `buildChartOption`, `useECharts`.
- **`MetricsDashboard()`** — что делает: держит `const [dataset, setDataset] = useState<MetricsDataset | null>(null)`,
  рендерит `<JsonUploadForm onLoaded={setDataset} />` и `<MetricsChart dataset={dataset} />`.
  Зависит от двух компонентов выше.
- **`POST /api/metrics`** — что делает: `await req.formData()` → берёт `file` → `file.text()`
  → `JSON.parse` → `parseMetrics`. Успех → `200` с датасетом; ошибки → `400 { error }`.
  Зависит от `parseMetrics`.

## Контракт данных и тела запроса

Формат JSON-файла — как и раньше:

```jsonc
{
  "currency": "USD",
  "points": [
    { "date": "2026-06-12", "cost": 44.36, "cpa": 12.1, "roi": 161.47, "conversions": 36 }
    // …
  ]
}
```

- `date` — `YYYY-MM-DD`; `cost`/`cpa` — валюта; `roi` — проценты; `conversions` — целое;
  `currency` — код валюты (по умолчанию `USD`).

Тело `POST /api/metrics`: `multipart/form-data` с полем **`file`** (выбранный `.json`).
Клиент не выставляет `Content-Type` вручную (браузер сам ставит boundary).

## Поток данных (по шагам)

1. Старт: `dataset = null` → `MetricsChart` показывает заглушку
   «Загрузите JSON, чтобы построить график».
2. Пользователь выбирает файл и жмёт «Загрузить JSON».
3. `JsonUploadForm`: `new FormData()` + `append('file', file)` → `fetch('/api/metrics', { method: 'POST', body })`.
4. Роут парсит/валидирует → `200 {currency, points}` или `400 {error}`.
5. Успех → `onLoaded(dataset)` → `setDataset` в дашборде → `MetricsChart` перерисовывается.
6. Ошибка → форма показывает текст ошибки; график остаётся как был.

## Обработка ошибок и краевых случаев

- POST: нет файла / поле не `File` → `400 «Файл не передан»`; невалидный JSON
  (`JSON.parse` бросил) → `400 «Невалидный JSON»`; не прошла схема (`parseMetrics` бросил)
  → `400` с сообщением из `parseMetrics`.
- Форма: состояние `loading` — кнопка «Загрузка…», задизейблена; `error` — текст под формой;
  при ошибке текущий график не сбрасывается.
- Загружен валидный JSON с пустым `points` → датасет валиден → график показывает заглушку.

## Тестирование (TDD, Vitest + RTL)

Сначала тест, затем реализация, затем рефактор; после итерации — линт.

- **`POST /api/metrics`** (`route.test.ts`, env node): валидный файл → `200` + датасет;
  нет файла → `400`; невалидный JSON → `400`; данные не по схеме → `400`.
  Запрос строится через глобальные `FormData`/`File`/`Request` (Node 20+, undici).
  Существующие тесты `GET` сохраняются.
- **`MetricsChart`** (`MetricsChart.test.tsx`, env jsdom): `dataset` с точками → в `useECharts`
  уходит опция с 4 сериями; `dataset = null` → заглушка; пустой `points` → заглушка.
  `useECharts` мокается (canvas нет в jsdom). Старые тесты про fetch/loading/error — удаляются
  (логика переехала).
- **`JsonUploadForm`** (`JsonUploadForm.test.tsx`, env jsdom): есть `input[type=file]` и кнопка
  «Загрузить JSON»; сабмит с выбранным файлом (мок `fetch`) → вызывает `onLoaded` с датасетом;
  ответ `400` → показывает сообщение об ошибке, `onLoaded` не вызывается.

## README.md (русский, подробно)

Разделы:
1. Что это и стек (Next.js 16, React 19, ECharts, zod).
2. **Установка**: `npm install`.
3. **Запуск**:
   - dev: `npm run dev` (открыть `http://localhost:3000`); предупреждение, что **первая
     компиляция страницы может занять 1–3 минуты** на медленном диске — это нормально;
   - рекомендуемый быстрый просмотр: `npm run build && npm start` (компиляция один раз,
     дальше мгновенная отдача).
4. **Как инициализировать график**: по умолчанию пусто; нажать «Загрузить JSON», выбрать
   `.json` нужного формата → график построится.
5. **Формат JSON** с полным примером (контракт данных выше).
6. **API**: `GET /api/metrics` (сэмпл из `data/metrics.json`), `POST /api/metrics`
   (`multipart/form-data`, поле `file`).
7. **Тесты и линт**: `npm test`, `npm run lint`, `npm run format`.
8. Примечание про медленный диск (проект на `/dev/sdb2`) и совет по ускорению dev.

## Вне scope (YAGNI)

- Вставка JSON текстом (textarea), drag-and-drop.
- Кнопка «Загрузить пример».
- Серверное хранение загруженного датасета (данные живут только в состоянии страницы,
  сбрасываются при перезагрузке).
- Изменение стилей/поведения самого графика.
