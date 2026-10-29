import { defineConfig } from 'vitest/config';

// Explicit-only config for the real Judge0 smoke test (not part of `npm test`).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/judge0/*.smoke.ts'],
  },
});
