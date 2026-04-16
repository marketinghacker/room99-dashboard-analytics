import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config } from 'dotenv';

// Load .env.local for integration tests that need DATABASE_URL or MCP endpoints.
config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    coverage: { reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
