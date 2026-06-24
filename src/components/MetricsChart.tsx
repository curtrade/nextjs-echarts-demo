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
