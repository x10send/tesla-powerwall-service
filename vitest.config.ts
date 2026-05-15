import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      // No Tesla credentials needed — service uses local gateway API only
    },
    setupFiles: ['./test/setup.ts'],
  },
})
