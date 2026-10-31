import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// End-to-end smoke suite against a production build (`npm run test:e2e` builds first).
// Always an isolated database: e2e/seed.ts refuses names that don't end in `_e2e`.
const PORT = Number(process.env.E2E_PORT ?? 5100);
// E2E_BASE_URL targets an already-running deployment (e.g. the Docker image) instead of starting
// `next start`; seed its database first with `MONGODB_URI=... npx tsx e2e/seed.ts`, and point its
// SMTP_HOST/SMTP_PORT and SITE_URL at the Mailpit and URL this suite uses (accounts.spec reads the emails).
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;
const BASE_URL = EXTERNAL_BASE_URL ?? `http://localhost:${PORT}`;
const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/blog_e2e";
// Fresh per run: only the server started below uses them (push.spec subscribes through the app).
const VAPID = webpush.generateVAPIDKeys();
// Microsoft Edge installed from Flathub runs fine outside the sandbox; override for other installs.
const EDGE_PATH = process.env.E2E_EDGE_PATH ?? "/var/lib/flatpak/app/com.microsoft.Edge/current/active/files/extra/msedge";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: BASE_URL,
        // deploy/staging.sh serves https://localhost from Caddy's local CA, which the host deliberately doesn't trust.
        ignoreHTTPSErrors: BASE_URL.startsWith("https://localhost"),
        trace: "retain-on-failure",
    },
    // `npm run test:e2e` runs chromium; `npm run test:e2e:browsers` adds the installed Chrome and Edge
    // (real push services, unlike the bundled Chromium), Playwright's Firefox, and a phone viewport.
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
        { name: "msedge", use: { ...devices["Desktop Edge"], launchOptions: { executablePath: EDGE_PATH } } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "mobile", use: { ...devices["Pixel 7"] } },
    ],
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
            // Mailpit (docker compose --profile mail up -d mailpit) catches verification and reset emails.
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: process.env.E2E_SMTP_PORT ?? "1025",
            SITE_URL: BASE_URL,
            VAPID_PUBLIC_KEY: VAPID.publicKey,
            VAPID_PRIVATE_KEY: VAPID.privateKey,
            VAPID_CONTACT_EMAIL: "mailto:e2e@example.com",
        },
    },
});
