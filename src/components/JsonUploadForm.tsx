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
