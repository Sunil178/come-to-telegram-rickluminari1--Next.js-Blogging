# Production deployment checklist

What a first production deployment of the Docker Compose stack needs, in order. `deploy/staging.sh` runs the same stack locally (on `https://localhost:8443`, with Mailpit instead of a real mail provider) and is the place to try changes before they reach the server.

## Before launch

The application is ready for a single-instance launch: every flow has an end-to-end test, and the suite passes in Chromium, Chrome, Edge, Firefox and a phone viewport (real Web Push is tested in Chrome and Edge only, and one intermittent Firefox failure, QA-24 in `docs/qa/checklist.md`, is still open); security, backups, staging and load were tested (`docs/production-readiness/`, `docs/qa/report.md`). What remains needs the owner's accounts or decisions:

| Item | Who | Where |
|---|---|---|
| Server, domain, DNS | Owner | Sections 1 and 2 |
| Transactional email provider with SPF, DKIM and DMARC records | Owner | Sections 1 and 3 |
| Production `.env` with fresh secrets, stored in a password manager | Owner, with agent help | Section 4 |
| First start, first admin, geolocation file, smoke test | Owner, with agent help | Section 5 |
| Scheduled backups with an offsite copy, and one restore drill | Owner (storage account), agent (cron and drill) | Section 5, `docs/procedures/backup-restore.md` |
| Uptime monitor | Owner (account) | Section 6 |
| Error tracker (Sentry or GlitchTip) | Owner picks; agent integrates | Section 6, `docs/roadmap.md` (Error tracking) |
| First run of the CI workflow on GitHub (`.github/workflows/ci.yml`, written but never run there) | Owner approves a push; agent fixes what fails | `docs/roadmap.md` (CI/CD) |
| The real logo for the app icons (generated stand-ins until then) | Owner | `docs/roadmap.md` (PWA icons) |
| Optional, not needed for launch: whether search needs typo tolerance (Atlas Search or Meilisearch) | Owner decides | `docs/roadmap.md` (Search at scale) |

## 1. Accounts and resources to have ready

| What | Why | Examples |
|---|---|---|
| A Linux server (2 vCPU, 2–4 GB RAM, 40 GB disk to start) with Docker and the Compose plugin | Runs the app, MongoDB and Caddy | Hetzner, DigitalOcean, Linode, AWS Lightsail |
| A domain you control | HTTPS certificates are only issued for a domain whose DNS points at the server | Any registrar; Cloudflare DNS works well |
| A transactional email provider | Verification and password-reset emails | Amazon SES, Postmark, Brevo, Mailgun, Resend (SMTP credentials) |
| Offsite storage for backups | Surviving the loss of the server | S3, Backblaze B2, Cloudflare R2 |
| Uptime monitor and error tracker | Knowing about outages and crashes before users report them | See [Monitoring](#5-monitoring) |

## 2. Server and DNS

- Open ports 80 and 443 (and SSH) in the firewall; nothing else. MongoDB is published on loopback only.
- DNS `A` record (and `AAAA` for IPv6) for the site's domain → the server's IP. Caddy gets a Let's Encrypt certificate on first start once this resolves.
- On Linux 6.19 or newer, the bundled `mongo:8` needs the `GLIBC_TUNABLES` setting already in `docker-compose.yml` ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)).

## 3. Email deliverability (SPF, DKIM, DMARC)

Mail providers like Gmail and Outlook reject or spam-folder mail from domains that don't prove the sender is allowed. Three DNS `TXT` records do that; the email provider shows the exact values when you add the domain:

- **SPF** lists the servers allowed to send mail for the domain, for example `v=spf1 include:amazonses.com -all`.
- **DKIM** publishes a public key; the provider signs every message with the matching private key, so receivers can check the message is genuine and unmodified.
- **DMARC** tells receivers what to do when SPF or DKIM fails and where to send reports. Start with `v=DMARC1; p=none; rua=mailto:dmarc@your-domain` to watch, then move to `p=quarantine` once reports look clean.

Send from an address on the same domain (`MAIL_FROM="Vedev.Guru <no-reply@your-domain>"`), and test with a real Gmail and Outlook inbox before launch (or mail-tester.com).

## 4. Configuration (`.env` on the server)

Generate fresh values for this environment; never reuse local or staging ones. Every variable is described in `.env.example` and the README.

- `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_URL` and `SITE_URL` = `https://your-domain`, `SITE_DOMAIN=your-domain`.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), `VAPID_CONTACT_EMAIL`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
- `PRIVACY_CONTACT_EMAIL` for the privacy page.
- `TRUSTED_PROXY_HOPS=1` behind the bundled Caddy (or `CLIENT_IP_HEADER` behind Cloudflare).
- Store a copy of the file in a password manager: losing `AUTH_SECRET` signs everyone out, and losing the VAPID keys breaks every push subscription.

## 5. First start

1. `git clone` the repository on the server, add `.env`, then `docker compose --profile proxy up -d --build`.
2. Create the first admin: `MONGODB_URI=mongodb://127.0.0.1:27018/blog npm run bootstrap-admin` (from the checkout, with Node installed).
3. Download the IP geolocation database (`npm run geoip:download` in the checkout; Compose mounts `./data/geoip`) and schedule a monthly refresh, for example `0 4 2 * * cd /srv/vedev-blog && npm run geoip:download` (the app reloads the file on its own).
4. Schedule backups and the offsite copy ([procedure](procedures/backup-restore.md)), then run one backup and one restore drill.
5. Smoke test in a real browser: register (the email arrives and isn't in spam), verify, sign in, write a post, approve it as admin, comment from another account, enable push notifications, reset a password, download your data.

## 6. Monitoring

- **Uptime:** an external check of `https://your-domain/api/health` every minute that alerts by email or chat when it isn't `200` (UptimeRobot, Better Stack, or self-hosted Uptime Kuma on another machine). The endpoint also reports a lost database connection.
- **Errors:** an error tracker such as Sentry (hosted, free tier) or GlitchTip (self-hosted, Sentry-compatible) catches server and browser exceptions with stack traces. Not integrated yet; it hooks into `onRequestError` in `src/instrumentation.ts`, which already sees every unhandled server error.
- **Logs:** the app writes JSON lines to stdout (`docker compose logs app`). Configure Docker's log rotation (`/etc/docker/daemon.json`: `"log-opts": {"max-size": "20m", "max-file": "5"}`) or ship them to a log service.
- **Disk:** alert at 80% usage; the `mongo-data` and `uploads` volumes and local backups grow over time.
- **Certificates:** Caddy renews automatically; the uptime monitor's TLS-expiry alert is a cheap safety net.

## 7. Known limits at launch

One app instance with a local disk: in-memory rate limits and local uploads (see `docs/roadmap.md`). The load test in `docs/production-readiness/load-test.md` shows what one instance handles.
