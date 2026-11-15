import { defineConfig } from 'cypress';

/**
 * End-to-end tests: the real web app + the real API + PostgreSQL.
 * Only YouTube is faked (search results, audio, covers, IFrame player), so the
 * suite is deterministic and runs anywhere. See TESTING.md to start the stack.
 */
export default defineConfig({
  e2e: {
    baseUrl: process.env.E2E_WEB_URL || 'http://localhost:5174',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
  },
});
