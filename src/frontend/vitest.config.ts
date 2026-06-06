import { defineConfig } from 'vitest/config'

// Pure-logic + sql.js-in-Node tests for the Board Explorer. Node environment so
// sql.js can read its WASM from node_modules; no browser/DOM needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
