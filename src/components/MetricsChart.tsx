'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MetricsDataset } from '@/lib/metrics/types';
import { buildChartOption } from '@/lib/chart/buildOption';
import { useECharts } from '@/hooks/useECharts';

type Status = 'loading' | 'error' | 'ready';

const overlayStyle: CSSProperties = {
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
          <button type="button" onClick={retry}>
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
