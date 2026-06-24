import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Фиксируем корень воркспейса на этом проекте: рядом в дереве есть
  // другой package-lock.json, из-за которого Next выбирал неверный root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
