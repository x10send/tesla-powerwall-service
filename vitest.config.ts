import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      TESLA_CLIENT_ID: 'test-client-id',
      TESLA_CLIENT_SECRET: 'test-client-secret',
      // DATA_DIR is set per-fork by test/setup.ts to avoid parallel file races
    },
    setupFiles: ['./test/setup.ts'],
  },
})
