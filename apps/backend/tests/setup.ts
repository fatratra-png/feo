/**
 * Loaded before every test file (see `--file` in package.json).
 *
 * - Gives the config the variables it requires, so unit tests run anywhere (CI included).
 * - With TEST_DATABASE_URL, points the API at that database for the integration suite.
 *   Locally, a dedicated schema keeps tests away from dev data:
 *   TEST_DATABASE_URL="postgresql://feo:…@localhost:5432/feo?options=-c%20search_path%3Dfeo_test"
 * - Disables the AI (no LLM calls from tests) and background stream warm-ups.
 */
process.env.NODE_ENV = 'test';
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;
}
process.env.DATABASE_URL ??= 'postgresql://unused@localhost:1/unused';
process.env.JWT_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.LLM_API_KEY = '';
