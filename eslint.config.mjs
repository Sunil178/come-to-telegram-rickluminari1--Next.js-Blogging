import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
    globalIgnores([".kilo/**", ".worktrees/**", ".claude/worktrees/**", "uploads/**", "public/uploads/**", "playwright-report/**", "test-results/**"]),
    {
        extends: [...nextCoreWebVitals],
    },
    {
        // Each banned call caused a test race here; docs/kits/flow-qa/method.md § 8 (Known traps).
        files: ["e2e/**/*.ts"],
        rules: {
            "no-restricted-properties": [
                "error",
                { property: "waitForResponse", message: "Can match an earlier identical response; wait for what the page shows instead." },
                { property: "waitForRequest", message: "Can match an earlier identical request; wait for what the page shows instead." },
                { property: "waitForNavigation", message: "Deprecated and racy; wait for what the new page shows instead." },
                { property: "waitForLoadState", message: "Returns at once when the state was already reached; wait for what the page shows instead." },
                { property: "waitForTimeout", message: "Only for checking that nothing happens; add an eslint-disable-next-line comment saying so." },
            ],
        },
    },
]);