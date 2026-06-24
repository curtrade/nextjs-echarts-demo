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
