import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke suite against a production build (`npm run test:e2e` builds first).
// Always an isolated database: e2e/seed.ts refuses names that don't end in `_e2e`.
const PORT = Number(process.env.E2E_PORT ?? 5100);
// E2E_BASE_URL targets an already-running deployment (e.g. the Docker image) instead of starting
// `next start`; seed its database first with `MONGODB_URI=... npx tsx e2e/seed.ts`.
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL ?? `http://localhost:${PORT}`;
const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/blog_e2e";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: EXTERNAL_BASE_URL ? undefined : {
        // Seed first so the server builds its indexes on the fresh database.
        command: `npx tsx e2e/seed.ts && npx next start --port=${PORT}`,
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            MONGODB_URI: E2E_MONGODB_URI,
            AUTH_URL: BASE_URL,
            AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret-not-for-production-use-000000",
            TRUSTED_PROXY_HOPS: "1",
            // Keeps test uploads out of the owner's uploads/ (gitignored, next to public/ like in the image).
            UPLOAD_DIR: ".e2e-uploads",
        },
    },
});
