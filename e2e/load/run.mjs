// Load test: each scenario runs autocannon for DURATION seconds at each concurrency level and prints a
// Markdown table (throughput, latency percentiles, errors, server memory).
//   node e2e/load/run.mjs http://localhost:5100 [server-pid]
// Seed first: e2e/seed.ts, then e2e/load/seed-volume.ts, against the same *_e2e database.
import { execFileSync } from "node:child_process";

const [base = "http://localhost:5100", serverPid] = process.argv.slice(2);
const DURATION = Number(process.env.LOAD_DURATION ?? 20);
const LEVELS = (process.env.LOAD_CONNECTIONS ?? "10,50,100").split(",").map(Number);

const SCENARIOS = [
    { name: "Home page", path: "/" },
    { name: "Posts list", path: "/posts" },
    { name: "Posts list, page 50", path: "/posts?page=50" },
    { name: "Post with 30 comments and related posts", path: "/posts/load-post-0" },
    { name: "Search", path: "/posts?q=performance" },
    { name: "Sitemap (2,000 posts)", path: "/sitemap.xml" },
    { name: "Signed-in notifications page", path: "/dashboard/notifications", signedIn: true },
];

async function sessionCookie() {
    const csrf = await fetch(`${base}/api/auth/csrf`);
    const { csrfToken } = await csrf.json();
    const cookies = csrf.headers.getSetCookie().map((c) => c.split(";")[0]);
    const body = new URLSearchParams({ csrfToken, username: "load-author0@example.com", password: "Passw0rd!", callbackUrl: base });
    const login = await fetch(`${base}/api/auth/callback/credentials`, {
        method: "POST", redirect: "manual", body, headers: { cookie: cookies.join("; "), "content-type": "application/x-www-form-urlencoded" },
    });
    const session = login.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.includes("session-token"));
    if (!session) throw new Error("Sign-in for the load test failed");
    return session;
}

function rssMb() {
    if (!serverPid) return "";
    const kb = Number(execFileSync("ps", ["-o", "rss=", "-p", serverPid]).toString().trim());
    return `${Math.round(kb / 1024)}`;
}

const cookie = await sessionCookie();
console.log(`Target ${base}, ${DURATION}s per run\n`);
console.log("| Scenario | Connections | Req/s | p50 ms | p90 ms | p99 ms | Max ms | Non-2xx | Errors | Server RSS MB |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const scenario of SCENARIOS) {
    for (const connections of LEVELS) {
        const args = ["--yes", "autocannon@8.0.0", "-j", "-c", String(connections), "-d", String(DURATION), "-t", "30"];
        if (scenario.signedIn) args.push("-H", `cookie=${cookie}`);
        const result = JSON.parse(execFileSync("npx", [...args, `${base}${scenario.path}`], { maxBuffer: 64 * 1024 * 1024 }).toString());
        const l = result.latency;
        console.log(`| ${scenario.name} | ${connections} | ${Math.round(result.requests.average)} | ${l.p50} | ${l.p90} | ${l.p99} | ${l.max} | ${result.non2xx} | ${result.errors + result.timeouts} | ${rssMb()} |`);
    }
}
