import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Лёгкое node-окружение по умолчанию; компонентные тесты включают jsdom
    // через директиву `// @vitest-environment jsdom` в самом файле.
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
