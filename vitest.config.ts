import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    pool: 'forks',
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/job-research-agent/skills/**',
        'src/job-research-agent/report/**',
        'src/job-research-agent/web/services/**',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
