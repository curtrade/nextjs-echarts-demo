import { MetricsChart } from '@/components/MetricsChart';

export default function Home() {
  return (
    <main style={{ width: '100%', maxWidth: 680, margin: '40px auto', padding: '0 16px' }}>
      <MetricsChart />
    </main>
  );
}
