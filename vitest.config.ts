import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      TESLA_CLIENT_ID: 'test-client-id',
      TESLA_CLIENT_SECRET: 'test-client-secret',
      DATA_DIR: '/tmp/powerwall-test',
    },
  },
})
