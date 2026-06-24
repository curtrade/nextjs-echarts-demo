'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MetricsDataset } from '@/lib/metrics/types';
import { buildChartOption } from '@/lib/chart/buildOption';
import { useECharts } from '@/hooks/useECharts';
import styles from './MetricsChart.module.css';

type Status = 'loading' | 'error' | 'ready';

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

export function MetricsChart() {
  const [dataset, setDataset] = useState<MetricsDataset | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  // Загружаем данные на маунте и при каждом retry (reloadKey).
  // setState вызывается только в async-колбэках, без синхронного setState в теле эффекта.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/metrics', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data: MetricsDataset) => {
        setDataset(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, [reloadKey]);

  const retry = () => {
    setStatus('loading');
    setReloadKey((key) => key + 1);
  };

  const option = useMemo(
    () => (dataset && dataset.points.length > 0 ? buildChartOption(dataset) : null),
    [dataset],
  );
  const containerRef = useECharts(option);

  const isEmpty = status === 'ready' && dataset?.points.length === 0;

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
          {status === 'loading' && (
            <div role="status" className={styles.overlay}>
              Загрузка…
            </div>
          )}
          {status === 'error' && (
            <div role="alert" className={styles.overlay}>
              Не удалось загрузить данные.
              <button type="button" onClick={retry}>
                Повторить
              </button>
            </div>
          )}
          {isEmpty && (
            <div role="status" className={styles.overlay}>
              Нет данных за выбранный период
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
