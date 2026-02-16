import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only (keep Playwright specs out of Vitest)
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/specs/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
