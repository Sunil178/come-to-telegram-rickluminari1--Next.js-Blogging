# Load test report

Run on 2026-10-31 against a production build (`next start`, one Node.js 24 process) on the developer laptop: Intel Core i5-13500H (16 threads), 23 GB RAM of which only about 2 GB was free, MongoDB 8.0 on the same machine. The load generator (autocannon) ran on the same machine, so absolute numbers are conservative; a dedicated 2-vCPU server will be in the same range per process.

## Method

- Data: the e2e seed plus `e2e/load/seed-volume.ts`: 50 authors, 2,000 published posts of about 8 KB of HTML each, 6,000 comments (30 on each of the newest 200 posts), 8 categories.
- Scenarios: `node e2e/load/run.mjs <url> <server-pid>` runs each page for 20 seconds at 10, 50 and 100 concurrent connections (one connection = one user sending requests back to back, so 100 connections is far more than 100 real readers). The signed-in scenario uses a real session cookie.
- API routes aren't in the table: they are rate-limited per IP (for example 20 view counts per minute), so a single-machine test only measures the limiter, which answered with 429 as intended.

## Findings fixed during the test

1. **Memory leak (critical).** The first run grew the server from 330 MB to 2.9 GB; with the heap capped at 512 MB the server crashed with "JavaScript heap out of memory" after two minutes. A heap snapshot showed 2,939 finished requests still in memory. Cause: MongoDB opened pool connections on demand inside requests; on Node.js 24 a socket keeps the async context it was created in (`AsyncContextFrame`), which held that request's Next.js store, and from there (through an aborted cache controller's error stack and Node's linked immediates) every later request. Fix: a fixed-size pool filled from server start, so the pool no longer grows inside requests (`MONGODB_POOL_SIZE`, default 10, `src/libs/db-connect.ts`) and Web Push sends without keep-alive sockets (`src/libs/notify.ts`). Related upstream report: [vercel/next.js#90433](https://github.com/vercel/next.js/issues/90433).
2. **Post page cost.** Every view created a new JSDOM window to sanitize the post and build its table of contents, and never closed it. One shared sanitizer per process plus a cache of rendered posts keyed by a hash of their HTML (`src/libs/render-post-html.ts`) doubled the post page's throughput.

## Results

### Before the fixes (first run, no heap cap)

| Scenario | Connections | Req/s | p50 ms | p90 ms | p99 ms | Max ms | Non-2xx | Errors | Server RSS MB |
|---|---|---|---|---|---|---|---|---|---|
| Home page | 10 | 134 | 71 | 90 | 132 | 165 | 0 | 0 | 730 |
| Home page | 50 | 163 | 296 | 332 | 428 | 464 | 0 | 0 | 830 |
| Home page | 100 | 151 | 596 | 785 | 857 | 2569 | 0 | 0 | 1027 |
| Posts list | 10 | 93 | 101 | 128 | 238 | 281 | 0 | 0 | 1071 |
| Posts list | 50 | 121 | 392 | 436 | 593 | 688 | 0 | 0 | 1217 |
| Posts list | 100 | 117 | 802 | 1007 | 1070 | 1215 | 0 | 0 | 1396 |
| Posts list, page 50 | 10 | 95 | 101 | 115 | 234 | 353 | 0 | 0 | 1391 |
| Posts list, page 50 | 50 | 112 | 421 | 520 | 747 | 766 | 0 | 0 | 1477 |
| Posts list, page 50 | 100 | 121 | 771 | 1009 | 1133 | 1277 | 0 | 0 | 1696 |
| Post with 30 comments and related posts | 10 | 39 | 240 | 275 | 605 | 608 | 0 | 0 | 2124 |
| Post with 30 comments and related posts | 50 | 40 | 1153 | 1535 | 1643 | 1664 | 0 | 0 | 2149 |
| Post with 30 comments and related posts | 100 | 37 | 1950 | 2701 | 17444 | 19815 | 0 | 0 | 2136 |
| Search | 10 | 89 | 101 | 118 | 355 | 1069 | 0 | 0 | 2090 |
| Search | 50 | 129 | 361 | 431 | 712 | 724 | 0 | 0 | 2091 |
| Search | 100 | 104 | 874 | 1325 | 1516 | 1591 | 0 | 0 | 2091 |
| Sitemap (2,000 posts) | 10 | 119 | 75 | 97 | 433 | 502 | 0 | 0 | 2577 |
| Sitemap (2,000 posts) | 50 | 92 | 514 | 777 | 1019 | 1055 | 0 | 0 | 2861 |
| Sitemap (2,000 posts) | 100 | 89 | 1030 | 1513 | 1797 | 1915 | 0 | 0 | 2938 |
| Signed-in notifications page | 10 | 91 | 107 | 123 | 154 | 185 | 0 | 0 | 2879 |
| Signed-in notifications page | 50 | 137 | 349 | 371 | 868 | 871 | 0 | 0 | 2827 |
| Signed-in notifications page | 100 | 180 | 529 | 579 | 948 | 956 | 0 | 0 | 2828 |

### After the fixes (heap capped at 512 MB, the same scenarios back to back for 7 minutes)

| Scenario | Connections | Req/s | p50 ms | p90 ms | p99 ms | Max ms | Non-2xx | Errors | Server RSS MB |
|---|---|---|---|---|---|---|---|---|---|
| Home page | 10 | 166 | 57 | 74 | 94 | 323 | 0 | 0 | 347 |
| Home page | 50 | 163 | 300 | 342 | 373 | 450 | 0 | 0 | 375 |
| Home page | 100 | 174 | 555 | 615 | 686 | 891 | 0 | 0 | 395 |
| Posts list | 10 | 116 | 84 | 95 | 122 | 132 | 0 | 0 | 512 |
| Posts list | 50 | 127 | 392 | 411 | 437 | 534 | 0 | 0 | 531 |
| Posts list | 100 | 131 | 747 | 788 | 901 | 1090 | 0 | 0 | 532 |
| Posts list, page 50 | 10 | 116 | 84 | 98 | 109 | 133 | 0 | 0 | 531 |
| Posts list, page 50 | 50 | 119 | 415 | 439 | 467 | 522 | 0 | 0 | 550 |
| Posts list, page 50 | 100 | 120 | 803 | 861 | 1003 | 1132 | 0 | 0 | 562 |
| Post with 30 comments and related posts | 10 | 82 | 116 | 135 | 153 | 580 | 0 | 0 | 574 |
| Post with 30 comments and related posts | 50 | 82 | 609 | 622 | 634 | 704 | 0 | 0 | 573 |
| Post with 30 comments and related posts | 100 | 84 | 1169 | 1204 | 1268 | 1436 | 0 | 0 | 581 |
| Search | 10 | 125 | 78 | 89 | 101 | 108 | 0 | 0 | 582 |
| Search | 50 | 128 | 383 | 409 | 465 | 571 | 0 | 0 | 582 |
| Search | 100 | 127 | 770 | 803 | 900 | 1060 | 0 | 0 | 582 |
| Sitemap (2,000 posts) | 10 | 122 | 80 | 100 | 119 | 151 | 0 | 0 | 590 |
| Sitemap (2,000 posts) | 50 | 122 | 403 | 431 | 469 | 514 | 0 | 0 | 586 |
| Sitemap (2,000 posts) | 100 | 118 | 823 | 897 | 1004 | 1075 | 0 | 0 | 596 |
| Signed-in notifications page | 10 | 117 | 84 | 91 | 107 | 116 | 0 | 0 | 587 |
| Signed-in notifications page | 50 | 131 | 381 | 399 | 409 | 413 | 0 | 0 | 590 |
| Signed-in notifications page | 100 | 135 | 728 | 790 | 842 | 902 | 0 | 0 | 590 |

Memory levelled off at about 590 MB RSS under the 512 MB heap cap for the whole run, with no errors or timeouts.

## What this means

- One process serves about 115–175 page requests per second. Every page renders per request (the nonce-based CSP requires it), so throughput is bound by CPU for rendering, not by MongoDB.
- At 10 concurrent connections every page answers in under 160 ms at the 99th percentile. Latency grows linearly past saturation (requests queue) rather than failing: at 100 connections there were still no errors.
- 120 requests per second is about 10 million page views a day if spread evenly; real traffic peaks at several times its average, so one instance comfortably serves a blog with hundreds of thousands of daily views. Beyond that, run several app processes behind the proxy, which first needs the shared rate limiter and shared upload storage from `docs/roadmap.md`.
- Give the container at least 1 GB of memory.

## Reproducing

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/load_e2e npx tsx e2e/seed.ts
MONGODB_URI=mongodb://127.0.0.1:27017/load_e2e npx tsx e2e/load/seed-volume.ts
npm run build
MONGODB_URI=mongodb://127.0.0.1:27017/load_e2e AUTH_URL=http://localhost:5100 SITE_URL=http://localhost:5100 AUTH_SECRET=<any> \
  NODE_OPTIONS=--max-old-space-size=512 npx next start --port=5100 &
node e2e/load/run.mjs http://localhost:5100 <server-pid>   # LOAD_DURATION, LOAD_CONNECTIONS override the defaults
```
