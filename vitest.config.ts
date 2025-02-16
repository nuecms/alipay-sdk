import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node', // make sure to use node environment
    globals: true,       // if you want to use global variables
    setupFiles: './tests/setupEnv.ts', // setup file
  },
});
