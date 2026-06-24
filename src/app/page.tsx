import { MetricsChart } from '@/components/MetricsChart';

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px' }}>
      <h1>Метрики кампании</h1>
      <MetricsChart />
    </main>
  );
}
